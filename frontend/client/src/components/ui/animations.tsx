/**
 * Animation and Transition Components for CreatorHub Norge
 * Provides smooth animations, transitions, and motion effects
 * Material UI compliant with performance optimization
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Fade,
  Slide,
  Grow,
  Zoom,
  Collapse,
  Backdrop,
  useTheme,
  alpha,
} from '@mui/material';
import { keyframes } from '@emotion/react';
import { styled } from '@mui/material/styles';
import { motion, type Variants, type HTMLMotionProps } from 'framer-motion';

// Smooth fade-in animation component
interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  disabled?: boolean;
}

export function SmoothFadeIn({ 
  children, 
  delay = 0, 
  duration = 500,
  direction = 'up',
  disabled = false 
}: FadeInProps) {
  const [show, setShow] = useState(disabled);

  useEffect(() => {
    if (disabled) return;
    
    const timer = setTimeout(() => {
      setShow(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, disabled]);

  const getTransform = () => {
    switch (direction) {
      case 'up':
        return 'translateY(20px)';
      case 'down':
        return 'translateY(-20px)';
      case 'left':
        return 'translateX(20px)';
      case 'right':
        return 'translateX(-20px)';
      default: return 'translateY(20px)';
    }
  };

  if (disabled) return <>{children}</>;

  return (
    <Box
      sx={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : getTransform(),
        transition: `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`
      }}
    >
      {children}
    </Box>
  );
}

// Staggered animation for lists and grids
interface StaggeredAnimationProps {
  children: React.ReactNode[];
  delay?: number;
  stagger?: number;
}

export function StaggeredAnimation({ 
  children, 
  delay = 0, 
  stagger = 100 }: StaggeredAnimationProps) {
  return (
    <>
      {React.Children.map(children, (child, index) => (
        <SmoothFadeIn 
          key={index}
          delay={delay + (index * stagger)}
          duration={600}
        >
          {child}
        </SmoothFadeIn>
      ))}
    </>
  );
}

// Pulse animation for highlighting
const pulseKeyframes = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
}
  50% {
    transform: scale(1.05);
    opacity: 0.8;
}
  100% {
    transform: scale(1);
    opacity: 1;
}
`;

export const PulseBox = styled(Box)(({ theme }) => ({
  animation: `${pulseKeyframes} 2s ease-in-out infinite`,
  '&:hover': {
    animation: 'none',
    transform: 'scale(1.02)',
    transition: 'transform 0.2s ease-in-out'
  },
}));

// Floating action animation
const floatKeyframes = keyframes`
  0%, 100% {
    transform: translateY(0px);
}
  50% {
    transform: translateY(-5px);
}
`;

export const FloatingBox = styled(Box)({
  animation: `${floatKeyframes} 3s ease-in-out infinite`,
  '&:hover': {
    animation: 'none',
    transform: 'translateY(-2px)',
    transition: 'transform 0.3s ease-out'
  },
});

// Smooth card hover animation
export const AnimatedCard = styled(Box)(({ theme }) => ({
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8],
    '& .card-content': {
      transform: 'scale(1.02)'
    },
  },
  '& .card-content': {
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  },
}));

// Loading dots animation
const dotKeyframes = keyframes`
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0.5;
}
  40% {
    transform: scale(1);
    opacity: 1;
}
`;

interface LoadingDotsProps {
  size?: number;
  color?: string;
}

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

type AnimatedDivProps = HTMLMotionProps<'div'> & { delay?: number };

export function AnimatedFadeInUp({ delay = 0, children, ...rest }: AnimatedDivProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.3, delay } },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function LoadingDots({ size = 8, color = 'primary.main' }: LoadingDotsProps) {
  const theme = useTheme();

  // Theming system
  const theming = useTheming('photographer');
  
  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', justifyContent: 'center' }}>
      {[0, 1, 2].map((index) => (
        <Box
          key={index}
          sx={{
            width: size,
            height: size,
            borderRadius: '50%',
            bgcolor: color,
            animation: `${dotKeyframes} 1.4s ease-in-out infinite both`,
            animationDelay: `${index * 0.16}s`
          }}
        />
      ))}
    </Box>
  );
}

// Smooth page transition wrapper
interface PageTransitionProps {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
}

export function PageTransition({ children, direction = 'right' }: PageTransitionProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Slide direction={direction} in={mounted} timeout={400}>
      <div>{children}</div>
    </Slide>
  );
}

// Progress animation for forms and processes
interface ProgressAnimationProps {
  step: number;
  totalSteps: number;
  children: React.ReactNode;
}

export function ProgressAnimation({ step, totalSteps, children }: ProgressAnimationProps) {
  return (
    <Box sx={{ position: 'relative' }}>
      <Fade in={true} timeout={600}>
        <Box>
          {children}
        </Box>
      </Fade>
      
      {/* Progress indicator */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          display: 'flex',
          gap: 0.5,
          p: 1
        }}
      >
        {Array.from({ length: totalSteps }).map((_, index) => (
          <Box
            key={index}
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: index <= step ? 'primary.main' : 'grey.300',
              transition: 'background-color 0.3s ease-in-out',
              transform: index === step ? 'scale(1.3)' : 'scale(1)'
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

// Notification slide-in animation
interface NotificationSlideProps {
  show: boolean;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function NotificationSlide({ 
  show, 
  children, 
  position = 'top' 
}: NotificationSlideProps) {
  const getDirection = () => {
    switch (position) {
      case 'top':
        return 'down';
      case 'bottom':
        return 'up';
      case 'left':
        return 'right';
      case 'right':
        return 'left';
      default: return 'down';
    }
  };

  return (
    <Slide direction={getDirection()} in={show} timeout={300}>
      <div>{children}</div>
    </Slide>
  );
}

// Smooth accordion-style expand animation
interface ExpandProps {
  expanded: boolean;
  children: React.ReactNode;
}

export function SmoothExpand({ expanded, children }: ExpandProps) {
  return (
    <Collapse in={expanded} timeout={400}>
      <Box sx={{ pt: expanded ? 2 : 0 }}>
        {children}
      </Box>
    </Collapse>
  );
}

// Ripple effect animation for interactions
const rippleKeyframes = keyframes`
  0% {
    transform: scale(0);
    opacity: 1;
}
  100% {
    transform: scale(4);
    opacity: 0;
}
`;

interface RippleEffectProps {
  children: React.ReactNode;
  color?: string;
}

export function RippleEffect({ children, color = 'primary.main' }: RippleEffectProps) {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const createRipple = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const id = Date.now();

    setRipples(prev => [...prev, { id, x, y }]);

    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== id));
    }, 600);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer'
      }}
      onClick={createRipple}
    >
      {children}
      
      {ripples.map(ripple => (
        <Box
          key={ripple.id}
          sx={{
            position: 'absolute',
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20,
            borderRadius: '50%',
            bgcolor: alpha(color as string, 0.3),
            animation: `${rippleKeyframes} 0.6s linear`,
            pointerEvents: 'none'
          }}
        />
      ))}
    </Box>
  );
}
