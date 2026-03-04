/**
 * Contextual Micro-Animations for Enhanced User Engagement
 * Provides subtle, meaningful animations that enhance user experience.
 */

import type { ReactNode} from 'react';
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useAnimation, useInView, type Variants } from 'framer-motion';
import { Box, Button, type ButtonProps, Card, type CardProps, Fab, type FabProps, Typography } from '@mui/material';

export const animationVariants: Record<string, Variants> = {
  success: {
    initial: { scale: 1, rotate: 0 },
    animate: { scale: [1, 1.08, 1], rotate: [0, -4, 4, 0] },
    exit: { scale: 1, rotate: 0 },
  },
  error: {
    initial: { x: 0 },
    animate: { x: [0, -8, 8, -8, 8, 0] },
    exit: { x: 0 },
  },
  loading: {
    initial: { rotate: 0 },
    animate: { rotate: 360 },
    exit: { rotate: 0 },
  },
  hover: {
    initial: { scale: 1, y: 0 },
    animate: { scale: 1.03, y: -2 },
    exit: { scale: 1, y: 0 },
  },
  tap: {
    initial: { scale: 1 },
    animate: { scale: 0.96 },
    exit: { scale: 1 },
  },
  fadeIn: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  },
  slideIn: {
    initial: { opacity: 0, x: -16 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 16 },
  },
  bounce: {
    initial: { y: 0 },
    animate: { y: [0, -8, 0] },
    exit: { y: 0 },
  },
  pulse: {
    initial: { scale: 1 },
    animate: { scale: [1, 1.04, 1] },
    exit: { scale: 1 },
  },
  notification: {
    initial: { opacity: 0, scale: 0.4, rotate: 120 },
    animate: { opacity: 1, scale: 1, rotate: 0 },
    exit: { opacity: 0, scale: 0.4, rotate: -120 },
  },
};

const LOOPING_VARIANTS = new Set(['loading', 'pulse']);

const variantTransition = (variant: string) => {
  if (variant === 'loading') {
    return { duration: 1, repeat: Infinity, ease: 'linear' };
  }
  if (variant === 'pulse') {
    return { duration: 1.2, repeat: Infinity, ease: 'easeInOut' };
  }
  if (variant === 'notification') {
    return { type: 'spring', stiffness: 260, damping: 18 };
  }
  return { duration: 0.25, ease: 'easeOut' as const };
};

interface AnimatedComponentProps {
  children: ReactNode;
  variant: keyof typeof animationVariants;
  trigger?: 'hover' | 'tap' | 'inView' | 'mount' | 'manual';
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  onAnimationComplete?: () => void;
}

export function AnimatedComponent({
  children,
  variant,
  trigger = 'mount',
  delay = 0,
  className,
  style,
  onAnimationComplete,
}: AnimatedComponentProps) {
  const controls = useAnimation();
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });

  useEffect(() => {
    const runAnimation = () => {
      const keyframes = animationVariants[variant];
      if (keyframes?.animate) {
        void controls.start(keyframes.animate);
      }
    };

    if (trigger === 'mount') {
      const timeout = window.setTimeout(runAnimation, delay);
      return () => window.clearTimeout(timeout);
    }

    if (trigger === 'inView' && inView) {
      const timeout = window.setTimeout(runAnimation, delay);
      return () => window.clearTimeout(timeout);
    }

    return undefined;
  }, [controls, delay, inView, trigger, variant]);

  const keyframes = animationVariants[variant];

  return (
    <motion.div
      ref={ref}
      initial={keyframes.initial}
      animate={trigger === 'hover' || trigger === 'tap' ? undefined : controls}
      exit={keyframes.exit}
      whileHover={trigger === 'hover' ? keyframes.animate : undefined}
      whileTap={trigger === 'tap' ? animationVariants.tap.animate : undefined}
      className={className}
      style={style}
      transition={variantTransition(variant)}
      onAnimationComplete={onAnimationComplete}
    >
      {children}
    </motion.div>
  );
}

export function SuccessAnimation({ children, onComplete }: { children: ReactNode; onComplete?: () => void }) {
  return (
    <AnimatedComponent variant="success" trigger="mount" onAnimationComplete={onComplete}>
      {children}
    </AnimatedComponent>
  );
}

export function AnimatedLoadingSpinner({ size = 40, color = 'primary' }: { size?: number; color?: string }) {
  return (
    <motion.div
      initial={animationVariants.loading.initial}
      animate={animationVariants.loading.animate}
      transition={variantTransition('loading')}
      style={{ display: 'inline-flex' }}
    >
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: '3px solid transparent',
          borderTopColor: `${color}.main`,
          borderRightColor: `${color}.main`,
          borderBottomColor: `${color}.main`,
        }}
      />
    </motion.div>
  );
}

export function AnimatedNotificationBadge({ count, show }: { count: number; show: boolean }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="notification-badge"
          initial={animationVariants.notification.initial}
          animate={animationVariants.notification.animate}
          exit={animationVariants.notification.exit}
          transition={variantTransition('notification')}
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            backgroundColor: '#ef4444',
            color: '#ffffff',
            borderRadius: 999,
            minWidth: 20,
            height: 20,
            padding: '0 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            lineHeight: '20px',
          }}
        >
          {count > 99 ? '99+' : count}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

interface AnimatedButtonProps extends Omit<ButtonProps, 'children' | 'onClick'> {
  children: ReactNode;
  onClick?: ButtonProps['onClick'];
  success?: boolean;
  error?: boolean;
  loading?: boolean;
}

export function AnimatedButton({ children, onClick, success = false, error = false, loading = false, ...props }: AnimatedButtonProps) {
  const [stateVariant, setStateVariant] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');

  useEffect(() => {
    if (loading) {
      setStateVariant('loading');
      return;
    }
    if (success) {
      setStateVariant('success');
      const timeout = window.setTimeout(() => setStateVariant('idle'), 420);
      return () => window.clearTimeout(timeout);
    }
    if (error) {
      setStateVariant('error');
      const timeout = window.setTimeout(() => setStateVariant('idle'), 420);
      return () => window.clearTimeout(timeout);
    }
    setStateVariant('idle');
    return undefined;
  }, [error, loading, success]);

  const variantToUse = stateVariant === 'idle' ? 'fadeIn' : stateVariant;

  return (
    <motion.div
      initial={animationVariants[variantToUse].initial}
      animate={animationVariants[variantToUse].animate}
      exit={animationVariants[variantToUse].exit}
      transition={variantTransition(variantToUse)}
      whileHover={animationVariants.hover.animate}
      whileTap={animationVariants.tap.animate}
    >
      <Button {...props} onClick={onClick}>
        {children}
      </Button>
    </motion.div>
  );
}

interface AnimatedMuiCardProps extends Omit<CardProps, 'children'> {
  children: ReactNode;
  onClick?: CardProps['onClick'];
}

export function AnimatedMuiCard({ children, onClick, ...props }: AnimatedMuiCardProps) {
  return (
    <motion.div whileHover={animationVariants.hover.animate} whileTap={animationVariants.tap.animate} transition={variantTransition('hover')}>
      <Card {...props} onClick={onClick}>
        {children}
      </Card>
    </motion.div>
  );
}

export function AnimatedListItem({ children, index = 0, delay = 0.08 }: { children: ReactNode; index?: number; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * delay, duration: 0.22, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedProgressBar({ progress, color = '#2563eb', height = 8 }: { progress: number; color?: string; height?: number }) {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <Box sx={{ width: '100%', height, backgroundColor: '#e5e7eb', borderRadius: height / 2, overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{ height: '100%', backgroundColor: color, borderRadius: height / 2 }}
      />
    </Box>
  );
}

interface AnimatedFloatingButtonProps extends Omit<FabProps, 'children' | 'onClick'> {
  children: ReactNode;
  onClick?: FabProps['onClick'];
  pulse?: boolean;
}

export function AnimatedFloatingButton({ children, onClick, pulse = false, ...props }: AnimatedFloatingButtonProps) {
  return (
    <motion.div
      animate={pulse ? animationVariants.pulse.animate : undefined}
      transition={pulse ? variantTransition('pulse') : undefined}
      whileHover={animationVariants.hover.animate}
      whileTap={animationVariants.tap.animate}
    >
      <Fab
        {...props}
        onClick={onClick}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
          '&:hover': {
            background: 'linear-gradient(135deg, #d97706, #c2410c)',
          },
          ...(props.sx || {}),
        }}
      >
        {children}
      </Fab>
    </motion.div>
  );
}

export function TypewriterText({ text, speed = 45, onComplete }: { text: string; speed?: number; onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= text.length) {
      if (onComplete) onComplete();
      return;
    }

    const timeout = window.setTimeout(() => {
      setDisplayedText((previous) => previous + text[index]);
      setIndex((previous) => previous + 1);
    }, speed);

    return () => window.clearTimeout(timeout);
  }, [index, onComplete, speed, text]);

  return (
    <Typography>
      {displayedText}
      {index < text.length ? (
        <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.7, repeat: Infinity }}>
          |
        </motion.span>
      ) : null}
    </Typography>
  );
}

export function StaggeredContainer({ children, staggerDelay = 0.1 }: { children: ReactNode; staggerDelay?: number }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {React.Children.map(children, (child, childIndex) => (
        <motion.div
          key={`stagger-${childIndex}`}
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

// Export helper to inspect whether a variant loops.
export function isLoopingVariant(name: keyof typeof animationVariants): boolean {
  return LOOPING_VARIANTS.has(name);
}
