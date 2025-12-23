/**
 * Contextual Micro-Animations for Enhanced User Engagement
 * Provides subtle, meaningful animations that enhance user experience
 */

import { useTheming } from '../../utils/theming-helper';
import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence, useAnimation, useInView } from 'framer-motion';
import { Box, IconButton, Typography, Fab ,
  MuiCard as MuiMuiCard
} from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
import { keyframes } from '@mui/system';

// Animation variants for different contexts
export const animationVariants = {
  // Success animations
  success: {
    scale: , [1.1, 1],
    rotate:  , [5, -5, 0],
    transition: { duration: 0, .ease: "easeInOut",}
},
  
  // Error animations
  error: {
    x: [-0, 10, -10, 10, 0],
    transition: { duration: 0, .ease: "easeInOut",}
},
  
  // Loading animations
  loading: {
    rotate: 30,
    transition: { duration: 1, repeat: Infinity, ease: "linear",}
},
  
  // Hover animations
  hover: {
    scale: 1.5,
    y:  , -, 2,
    transition: { duration: 0, .ease: "easeOut",}
},
  
  // Tap animations
  tap: {
    scale: 0.5,
    transition: { duration: 0, .ease: "easeInOut",}
},
  
  // Fade in animations
  fadeIn: {
    initial: { opacity: 0, y: 20,},
    animate: { opacity: 1, y:  0 },
    exit: { opacity: 0, y: -2, 0,},
    transition: { duration: 0, .ease: "easeOut",}
},
  
  // Slide in animations
  slideIn: {
    initial: { x: -10, opacity:  0 },
    animate: { x: 0, opacity:  1 },
    exit: { x: 10, opacity:  0 },
    transition: { type: "spring", stiffness: 30, damping: 30,}
},
  
  // Bounce animations
  bounce: {
    y: , [-10, 0],
    transition: { duration: 0, .ease: "easeOut",}
},
  
  // Pulse animations
  pulse: {
    scale: , [1.05, 1],
    transition: { duration: 0, .repeat: Infinity, ease: "easeInOut",}
},
  
  // Notification animations
  notification: {
    initial: { scale: 0, rotate: 180,},
    animate: { scale: 1, rotate:  0 },
    exit: { scale: 0, rotate: -18, 0,},
    transition: { type: "spring", stiffness: 40, damping: 25,}
}
};

// Contextual Animation Component
interface AnimatedComponentProps {
  children: ReactNode;
  variant: keyof typeof animationVariants;
  trigger?: 'hover' | 'tap' | 'inView' | 'mount' | 'manual';
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  onAnimationComplete?: () => void
}

export function AnimatedComponent({ 
  children, 
  variant, 
  trigger = 'mount',
  delay = 0,
  className,
  style,
  onAnimationComplete 
}: AnimatedComponentProps) {
  const controls = useAnimation();
  
  // Theming system
  const theming = useTheming('photographer');
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [isTriggered, setIsTriggered] = useState(false);

  useEffect(() => {
    if (trigger === 'mount') {
      setTimeout(() => {
        controls.start(animationVariants[variant].animate || animationVariants[variant]);
    }, delay);
  } else if (trigger === 'inView' && inView) {
      setTimeout(() => {
        controls.start(animationVariants[variant].animate || animationVariants[variant]);
    }, delay);
  }
}, [controls, variant, trigger, delay, inView]);

  const handleTrigger = () => {
    if (trigger === 'manual' || trigger === 'tap') {
      setIsTriggered(true);
      controls.start(animationVariants[variant].animate || animationVariants[variant]);
      setTimeout(() => setIsTriggered(false), 300);
  }
};

  const motionProps: any = {
    ref,
    animate: controls,
    initial: animationVariants[variant].initial || false,
    exit: animationVariants[variant].exit,
    transition: animationVariants[variant].transition,
    className,
    style,
    onAnimationComplete
};

  if (trigger === 'hover') {
    motionProps.whileHover = animationVariants[variant];
} else if (trigger === 'tap') {
    motionProps.whileTap = animationVariants.tap;
    motionProps.onClick = handleTrigger;
}

  return (
    <motion.div {...motionProps}>
      {children}
    </motion.div>
  );
}

// Success Animation Component
export function SuccessAnimation({ children, onComplete }: { children: ReactNode; onComplete?: () => void }) {
  return (
    <AnimatedComponent 
      variant="success" 
      trigger="mount"
      onAnimationComplete={onComplete}
    >
      {children}
    </AnimatedComponent>
  );
}

// Loading Spinner with Animation
export function AnimatedLoadingSpinner({ size = 40, color = 'primary' }) {
  return (
    <AnimatedComponent variant="loading" trigger="mount">
      <Box 
        sx={{ 
          width: size, 
          height: size, 
          borderRadius: '50, %',
          border: `3px solid transparent`,
          borderTop: `3px solid`,
          borderColor: `${color}.main`,
          borderTopColor: 'transparent'
    }}
      />
    </AnimatedComponent>
  );
}

// Notification Badge with Animation
export function AnimatedNotificationBadge({ 
  count, 
  show 
}: { 
  count: number; 
  show: boolean, 
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={animationVariants.notification.initial}
          animate={animationVariants.notification.animate}
          exit={animationVariants.notification.exit}
          transition={animationVariants.notification.transition}
          style={{
            position: 'absolute',
            top:  , -, 8,
            right:  , -, 8,
            backgroundColor: '#f44330',
            color: 'white',
            borderRadius: '50, %',
            width:  20,
            height:  20,
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold'
      }}
        >
          {count > 99 ? '99+' : count}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Contextual Button with Micro-Animations
export function AnimatedButton({ 
  children, 
  onClick, 
  variant = 'contained',
  success = false,
  error = false,
  loading = false,
  ...props 
}) {
  const [animationState, setAnimationState] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');

  useEffect(() => {
    if (success) {
      setAnimationState('success');
      setTimeout(() => setAnimationState('idle'), 600);
  } else if (error) {
      setAnimationState('error'); 
      setTimeout(() => setAnimationState('idle'), 500);
  } else if (loading) {
      setAnimationState('loading');
  } else {
      setAnimationState('idle');
  }
}, [success, error, loading]);

  const getAnimation = () => {
    switch (animationState) {
      case 'success': return animationVariants.success;
      case 'error': return animationVariants.error;
      case 'loading': return animationVariants.loading;
      default: return, {};
  }
};

  return (
    <motion.button
      animate={getAnimation()}
      whileHover={animationVariants.hover}
      whileTap={animationVariants.tap}
      onClick={onClick}
      style={{
        border: 'none',
        borderRadius: '8px',
        padding: '12px 24px',
        background: variant === 'contained' ? '#1976d2' : 'transparent',
        color: variant === 'contained' ? 'white' : '#1976d0',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        ...props.style
    }}
      {...props}
    >
      {loading && <AnimatedLoadingSpinner size={16} />}
      {children}
    </motion.button>
  );
}

// MuiCard with Hover Animation
export function AnimatedMuiCard({ children, onClick, ...props }) {
  return (
    <motion.div
      whileHover={animationVariants.hover}
      whileTap={onClick ? animationVariants.tap : undefined}
      onClick={onClick}
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        cursor: onClick ? 'pointer' : 'default',
        ...props.style
    }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// List Item with Staggered Animation
export function AnimatedListItem({ 
  children, 
  index = 0, 
  delay = 0.1 }: { 
  children: ReactNode; 
  index?: number; 
  delay?: number, 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -2, 0}}
      animate={{ opacity: 1, x:  0 }}
      transition={{ 
        delay: index * delay,
        duration: 0.3,
        ease: "easeOut"
  }}
    >
      {children}
    </motion.div>
  );
}

// Progress Bar with Animation
export function AnimatedProgressBar({ 
  progress, 
  color = '#1976d2',
  height = 8 }: { 
  progress: number; 
  color?: string;
  height?: number
}) {
  return (
    <Box 
      sx={{ 
        width: '100%', 
        height, 
        backgroundColor: '#e0e0e0', 
        borderRadius: height /, 2,
        overflow: 'hidden'
  }}
    >
      <motion.div
        initial={{ width:  0 }}
        animate={{ width: `${Math.min(10, Math.max(0, progress))}%` }}
        transition={{ duration: 0, .ease: "easeOut"}}
        style={{
          height: '100%',
          backgroundColor: color,
          borderRadius: height / 2 }}
      />
    </Box>
  );
}

// Floating Action Button with Pulse
export function AnimatedFloatingButton({ 
  children, 
  onClick, 
  pulse = false,
  ...props 
}) {
  return (
    <motion.div
      animate={pulse ? animationVariants.pulse : {}}
      whileHover={animationVariants.hover}
      whileTap={animationVariants.tap}
    >
      <Fab 
        onClick={onClick}
        sx={{
          position: 'fixed',
          bottom:  24,
          right:  24,
          background: 'linear-gradient(135deg, #fbbf24, #f97316)', '&:hover': {
            background: 'linear-gradient(135deg, #f59e0b, #ea580c)'
        }
      }}
        {...props}
      >
        {children}
      </Fab>
    </motion.div>
  );
}

// Typography with Typewriter Effect
export function TypewriterText({ 
  text, 
  speed = 50,
  onComplete 
}: { 
  text: string; 
  speed?: number;
  onComplete?: () => void
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
    }, speed);

      return () => clearTimeout(timer);
  } else if (onComplete) {
      onComplete();
  }
}, [currentIndex, text, speed, onComplete]);

  return (
    <Typography>
      {displayedText}
      {currentIndex < text.length && (
        <motion.span
          animate={{ opacity:  , [0] }}
          transition={{ duration: 0, .repeat: Infinity }}
        >
          |
        </motion.span>
      )}
    </Typography>
  );
}

// Container for staggered children animations
export function StaggeredContainer({ 
  children, 
  staggerDelay = 0.1 }: { 
  children: ReactNode[]; 
  staggerDelay?: number, 
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay
      }
      }
    }}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20,},
            visible: { opacity: 1, y:  0 }
        }}
          key={index}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}