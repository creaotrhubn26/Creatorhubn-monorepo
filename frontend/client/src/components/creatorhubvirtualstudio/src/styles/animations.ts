/**
 * Animations
 * 
 * Keyframe animations and transition utilities
 */

import { transitions } from './designTokens';

/**
 * Keyframe animations
 */
export const keyframes = {
  // Fade in
  fadeIn: {
    '@keyframes fadeIn': {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
  },
  
  // Fade out
  fadeOut: {
    '@keyframes fadeOut': {
      from: { opacity: 1 },
      to: { opacity: 0 },
    },
  },
  
  // Slide in from top
  slideInTop: {
    '@keyframes slideInTop': {
      from: { transform: 'translateY(-100%)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 },
    },
  },
  
  // Slide in from bottom
  slideInBottom: {
    '@keyframes slideInBottom': {
      from: { transform: 'translateY(100%)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 },
    },
  },
  
  // Slide in from left
  slideInLeft: {
    '@keyframes slideInLeft': {
      from: { transform: 'translateX(-100%)', opacity: 0 },
      to: { transform: 'translateX(0)', opacity: 1 },
    },
  },
  
  // Slide in from right
  slideInRight: {
    '@keyframes slideInRight': {
      from: { transform: 'translateX(100%)', opacity: 0 },
      to: { transform: 'translateX(0)', opacity: 1 },
    },
  },
  
  // Scale in
  scaleIn: {
    '@keyframes scaleIn': {
      from: { transform: 'scale(0.9)', opacity: 0 },
      to: { transform: 'scale(1)', opacity: 1 },
    },
  },
  
  // Scale out
  scaleOut: {
    '@keyframes scaleOut': {
      from: { transform: 'scale(1)', opacity: 1 },
      to: { transform: 'scale(0.9)', opacity: 0 },
    },
  },
  
  // Pulse (for loading states)
  pulse: {
    '@keyframes pulse': {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.5 },
    },
  },
  
  // Spin (for spinners)
  spin: {
    '@keyframes spin': {
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' },
    },
  },
  
  // Skeleton shimmer
  shimmer: {
    '@keyframes shimmer': {
      '0%': { backgroundPosition: '-1000px 0' },
      '100%': { backgroundPosition: '1000px 0' },
    },
  },
} as const;

/**
 * Animation utilities
 */
export const animations = {
  fadeIn: {
    animation: 'fadeIn 0.3s ease-in-out',
  },
  fadeOut: {
    animation: 'fadeOut 0.3s ease-in-out',
  },
  slideInTop: {
    animation: 'slideInTop 0.3s ease-out',
  },
  slideInBottom: {
    animation: 'slideInBottom 0.3s ease-out',
  },
  slideInLeft: {
    animation: 'slideInLeft 0.3s ease-out',
  },
  slideInRight: {
    animation: 'slideInRight 0.3s ease-out',
  },
  scaleIn: {
    animation: 'scaleIn 0.2s ease-out',
  },
  scaleOut: {
    animation: 'scaleOut 0.2s ease-out',
  },
  pulse: {
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  },
  spin: {
    animation: 'spin 1s linear infinite',
  },
  shimmer: {
    animation: 'shimmer 2s infinite',
    background: 'linear-gradient(to right, #2a2a2a 0%, #3a3a3a 50%, #2a2a2a 100%)',
    backgroundSize: '1000px 100%',
  },
} as const;

/**
 * Transition utilities
 */
export const transitionUtils = {
  fast: {
    transition: transitions.fast,
  },
  normal: {
    transition: transitions.normal,
  },
  slow: {
    transition: transitions.slow,
  },
  all: {
    transition: `all ${transitions.normal}`,
  },
  transform: {
    transition: `transform ${transitions.normal}`,
  },
  opacity: {
    transition: `opacity ${transitions.fast}`,
  },
  colors: {
    transition: `background-color ${transitions.fast}, border-color ${transitions.fast}, color ${transitions.fast}`,
  },
} as const;


