/**
 * MicroInteractions - Reusable animated components for enhanced UX
 * 
 * Components:
 * - AnimatedButton: Press feedback with ripple
 * - AnimatedToggle: Smooth switch transition
 * - AnimatedTooltip: Fade-in with scale
 * - AnimatedCheckmark: Draw-on animation
 * - AnimatedSpinner: Smooth rotation
 * - SuccessBurst: Particle explosion for success states
 * - AnimatedSlider: Bounce on value change
 * - AnimatedBadge: Pop-in for notifications
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  ButtonProps,
  Switch,
  SwitchProps,
  Tooltip,
  TooltipProps,
  Slider,
  SliderProps,
  Badge,
  BadgeProps,
  CircularProgress,
  IconButton,
  IconButtonProps,
} from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import { Check } from '@mui/icons-material';
import {
  buttonPress,
  ripple,
  tooltipAppear,
  checkmarkDraw,
  spinnerRotate,
  popIn,
  sliderBounce,
  staggerFadeIn,
  animationDurations,
  animationEasings,
} from '../animations/storyboardAnimations';

// =============================================================================
// Animated Button
// =============================================================================

const ButtonRipple = styled(Box)({
  position: 'absolute',
  borderRadius: '50%',
  backgroundColor: 'rgba(255, 255, 255, 0.3)',
  pointerEvents: 'none',
  animation: `${ripple} 0.6s ease-out forwards`,
});

const StyledAnimatedButton = styled(Button)({
  position: 'relative',
  overflow: 'hidden',
  transition: `all ${animationDurations.fast} ${animationEasings.easeOut}`, '&:active': {
    animation: `${buttonPress} 0.15s ease-out`,
  },
});

export interface AnimatedButtonProps extends ButtonProps {
  enableRipple?: boolean;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  onClick,
  enableRipple = true,
  ...props
}) => {
  const [ripples, setRipples] = useState<Array<{ id: string; x: number; y: number; size: number }>>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (enableRipple && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = Math.max(rect.width, rect.height) * 2;
      
      const id = crypto.randomUUID();
      setRipples(prev => [...prev, { id, x, y, size }]);
      
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== id));
      }, 600);
    }
    
    onClick?.(e);
  }, [enableRipple, onClick]);

  return (
    <StyledAnimatedButton ref={buttonRef} onClick={handleClick} {...props}>
      {children}
      {ripples.map(r => (
        <ButtonRipple
          key={r.id}
          sx={{
            left: r.x - r.size / 2,
            top: r.y - r.size / 2,
            width: r.size,
            height: r.size}}
        />
      ))}
    </StyledAnimatedButton>
  );
};

// =============================================================================
// Animated Icon Button
// =============================================================================

const StyledAnimatedIconButton = styled(IconButton)({
  position: 'relative',
  overflow: 'hidden',
  transition: `all ${animationDurations.fast} ${animationEasings.easeOut}`,
  '&:active': {
    animation: `${buttonPress} 0.15s ease-out`,
  },
  '&:hover': {
    transform: 'scale(1.1)',
  },
});

export interface AnimatedIconButtonProps extends IconButtonProps {
  enableRipple?: boolean;
}

export const AnimatedIconButton: React.FC<AnimatedIconButtonProps> = ({
  children,
  onClick,
  enableRipple = true,
  ...props
}) => {
  const [ripples, setRipples] = useState<Array<{ id: string; x: number; y: number; size: number }>>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (enableRipple && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const x = rect.width / 2;
      const y = rect.height / 2;
      const size = Math.max(rect.width, rect.height) * 2;
      
      const id = crypto.randomUUID();
      setRipples(prev => [...prev, { id, x, y, size }]);
      
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== id));
      }, 600);
    }
    
    onClick?.(e);
  }, [enableRipple, onClick]);

  return (
    <StyledAnimatedIconButton ref={buttonRef} onClick={handleClick} {...props}>
      {children}
      {ripples.map(r => (
        <ButtonRipple
          key={r.id}
          sx={{
            left: r.x - r.size / 2,
            top: r.y - r.size / 2,
            width: r.size,
            height: r.size}}
        />
      ))}
    </StyledAnimatedIconButton>
  );
};

// =============================================================================
// Animated Toggle Switch
// =============================================================================

const toggleSlide = keyframes`
  0% {
    transform: scale(0.8);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
`;

const StyledAnimatedSwitch = styled(Switch)({
  '& .MuiSwitch-thumb': {
    transition: `all ${animationDurations.normal} ${animationEasings.spring}`,
  }, '& .MuiSwitch-switchBase.Mui-checked .MuiSwitch-thumb': {
    animation: `${toggleSlide} 0.3s ${animationEasings.spring}`,
  },
});

export const AnimatedSwitch: React.FC<SwitchProps> = (props) => {
  return <StyledAnimatedSwitch {...props} />;
};

// =============================================================================
// Animated Tooltip
// =============================================================================

const AnimatedTooltipContent = styled(Box)({
  animation: `${tooltipAppear} 0.2s ${animationEasings.easeOut} forwards`,
});

export const AnimatedTooltip: React.FC<TooltipProps> = ({ children, title, ...props }) => {
  return (
    <Tooltip
      {...props}
      title={
        <AnimatedTooltipContent>
          {title}
        </AnimatedTooltipContent>
      }
      componentsProps={{
        tooltip: {
          sx: {
            bgcolor: 'rgba(26, 26, 46, 0.95)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
          },
        }}}
    >
      {children}
    </Tooltip>
  );
};

// =============================================================================
// Animated Checkmark
// =============================================================================

const checkmarkPath = keyframes`
  0% {
    stroke-dashoffset: 24;
  }
  100% {
    stroke-dashoffset: 0;
  }
`;

const checkmarkCircle = keyframes`
  0% {
    stroke-dashoffset: 100;
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
`;

const checkmarkBounce = keyframes`
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
`;

interface AnimatedCheckmarkProps {
  size?: number;
  color?: string;
  show?: boolean;
  onComplete?: () => void;
}

export const AnimatedCheckmark: React.FC<AnimatedCheckmarkProps> = ({
  size = 48,
  color = '#4CAF50',
  show = true,
  onComplete,
}) => {
  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, 800);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <Box
      sx={{
        width: size,
        height: size,
        animation: `${checkmarkBounce} 0.4s ${animationEasings.spring}`}}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 52 52"
        style={{ display: 'block' }}
      >
        <circle
          cx="26"
          cy="26"
          r="24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray="100"
          style={{
            animation: `${checkmarkCircle} 0.5s ${animationEasings.easeOut} forwards`}}
        />
        <path
          d="M14 27 l8 8 l16 -16"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="24"
          style={{
            animation: `${checkmarkPath} 0.3s ${animationEasings.easeOut} 0.4s forwards`,
            strokeDashoffset: 24}}
        />
      </svg>
    </Box>
  );
};

// =============================================================================
// Animated Spinner
// =============================================================================

const spinnerPulse = keyframes`
  0%, 100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
`;

interface AnimatedSpinnerProps {
  size?: number;
  color?: string;
  thickness?: number;
}

export const AnimatedSpinner: React.FC<AnimatedSpinnerProps> = ({
  size = 40,
  color = '#2196F3',
  thickness = 4,
}) => {
  return (
    <Box
      sx={{
        position: 'relative',
        width: size,
        height: size}}
    >
      <CircularProgress
        size={size}
        thickness={thickness}
        sx={{
          color: color,
          animation: `${spinnerRotate} 1.4s linear infinite`}}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: size * 0.4,
          height: size * 0.4,
          borderRadius: '50%',
          bgcolor: color,
          opacity: 0.2,
          animation: `${spinnerPulse} 1.4s ease-in-out infinite`}}
      />
    </Box>
  );
};

// =============================================================================
// Success Burst Effect
// =============================================================================

const burstParticle = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 1;
  }
  100% {
    transform: translate(var(--tx), var(--ty)) scale(1);
    opacity: 0;
  }
`;

interface SuccessBurstProps {
  show?: boolean;
  color?: string;
  particleCount?: number;
  size?: number;
  onComplete?: () => void;
}

export const SuccessBurst: React.FC<SuccessBurstProps> = ({
  show = false,
  color = '#4CAF50',
  particleCount = 12,
  size = 100,
  onComplete,
}) => {
  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, 600);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  const particles = Array.from({ length: particleCount }, (_, i) => {
    const angle = (i / particleCount) * 360;
    const distance = size / 2;
    const tx = Math.cos((angle * Math.PI) / 180) * distance;
    const ty = Math.sin((angle * Math.PI) / 180) * distance;
    
    return (
      <Box
        key={i}
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: color'--tx': `${tx}px`'--ty': `${ty}px`,
          animation: `${burstParticle} 0.5s ${animationEasings.easeOut} forwards`,
          animationDelay: `${i * 0.02}s`,
        } as React.CSSProperties}
      />
    );
  });

  return (
    <Box
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: size,
        height: size,
        pointerEvents: 'none'}}
    >
      {particles}
    </Box>
  );
};

// =============================================================================
// Animated Slider
// =============================================================================

const StyledAnimatedSlider = styled(Slider)({
  '& .MuiSlider-thumb': {
    transition: `all ${animationDurations.fast} ${animationEasings.spring}`, '&:hover, &.Mui-focusVisible': {
      boxShadow: '0 0 0 8px rgba(33, 150, 243, 0.2)',
    }, '&.Mui-active': {
      animation: `${sliderBounce} 0.2s ${animationEasings.spring}`,
    },
  }, '& .MuiSlider-track': {
    transition: `all ${animationDurations.fast} ${animationEasings.easeOut}`,
  },
});

export const AnimatedSlider: React.FC<SliderProps> = (props) => {
  return <StyledAnimatedSlider {...props} />;
};

// =============================================================================
// Animated Badge
// =============================================================================

const badgePop = keyframes`
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.4);
  }
  100% {
    transform: scale(1);
  }
`;

const StyledAnimatedBadge = styled(Badge)({
  '& .MuiBadge-badge': {
    animation: `${badgePop} 0.3s ${animationEasings.spring}`,
  },
});

export interface AnimatedBadgeProps extends BadgeProps {
  animate?: boolean;
}

export const AnimatedBadge: React.FC<AnimatedBadgeProps> = ({
  animate = true,
  ...props
}) => {
  const [key, setKey] = useState(0);
  const prevContent = useRef(props.badgeContent);

  useEffect(() => {
    if (animate && props.badgeContent !== prevContent.current) {
      setKey(k => k + 1);
      prevContent.current = props.badgeContent;
    }
  }, [animate, props.badgeContent]);

  return <StyledAnimatedBadge key={key} {...props} />;
};

// =============================================================================
// Stagger Animation Container
// =============================================================================

interface StaggerContainerProps {
  children: React.ReactNode;
  staggerDelay?: number;
  direction?: 'row' | 'column';
  gap?: number;
}

export const StaggerContainer: React.FC<StaggerContainerProps> = ({
  children,
  staggerDelay = 0.05,
  direction = 'column',
  gap = 8,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: direction,
        gap: gap / 8'& > *': {
          animation: `${staggerFadeIn} 0.3s ${animationEasings.easeOut} forwards`,
          opacity: 0,
        },
        ...React.Children.toArray(children).reduce((acc, _, i) => ({
          ...acc,
          [`& > *:nth-of-type(${i + 1})`]: {
            animationDelay: `${i * staggerDelay}s`,
          },
        }), {})}}
    >
      {children}
    </Box>
  );
};

// =============================================================================
// Export all components
// =============================================================================

export default {
  AnimatedButton,
  AnimatedIconButton,
  AnimatedSwitch,
  AnimatedTooltip,
  AnimatedCheckmark,
  AnimatedSpinner,
  SuccessBurst,
  AnimatedSlider,
  AnimatedBadge,
  StaggerContainer,
};

