/**
 * Glass Components Library - Phase 2 Component Standardization
 * Universal glass components for Apple Liquid Glass design system
 */

import React from 'react';
import { motion } from 'framer-motion';
import { designTokens } from '../design-tokens';

// ============ TYPES ============

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'light' | 'medium' | 'heavy' | 'ultra';
  userType?: 'photographer' | 'videographer' | 'musicProducer' | 'admin';
  interactive?: boolean;
  animated?: boolean;
  // WCAG Compliance Properties
  ariaLabel?: string;
  ariaDescribedBy?: string;
  role?: string;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  userType?: 'photographer' | 'videographer' | 'musicProducer' | 'admin';
  motion?: 'spring' | 'elastic' | 'bounce' | 'smooth';
  loading?: boolean;
  // WCAG Compliance Properties
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
  focusRing?: boolean;
}

export interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'light' | 'medium' | 'heavy';
  userType?: 'photographer' | 'videographer' | 'musicProducer' | 'admin';
  icon?: React.ElementType;
  error?: string;
  // WCAG Compliance Properties
  label?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  helperText?: string;
}

export interface GlassModalProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  userType?: 'photographer' | 'videographer' | 'musicProducer' | 'admin';
}

export interface GlassNavigationProps {
  items: Array<{
    id: string;
    label: string;
    icon: React.ElementType;
    href?: string;
    onClick?: () => void;
    active?: boolean;
    disabled?: boolean;
    badge?: number;
  }>;
  userType?: 'photographer' | 'videographer' | 'musicProducer' | 'admin';
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
}

// ============ GLASS CARD COMPONENT ============

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  variant = 'medium',
  userType,
  interactive = false,
  animated = true,
  ariaLabel,
  ariaDescribedBy,
  role,
  tabIndex,
  onKeyDown,
  ...props
}) => {
  const baseClasses = 'glass-card rounded-lg border backdrop-blur-md transition-all duration-200';

  // WCAG AA compliant color schemes with proper contrast ratios
  const variantClasses = {
    light: 'bg-white/20 border-white/30 text-gray-900',
    medium: 'bg-white/25 border-white/35 text-gray-900',
    heavy: 'bg-white/30 border-white/40 text-gray-900',
    ultra: 'bg-white/35 border-white/45 text-gray-900',
  };

  const userTypeClasses = userType
    ? {
        photographer: 'glass-photographer border-amber-200/40 bg-amber-50/20',
        videographer: 'glass-videographer border-blue-200/40 bg-blue-50/20',
        musicProducer: 'glass-music-producer border-purple-200/40 bg-purple-50/20',
        admin: 'glass-admin border-gray-200/40 bg-gray-50/20',
      }[userType]
    : '';

  // Enhanced accessibility for interactive elements
  const interactiveClasses = interactive
    ? 'glass-interactive cursor-pointer hover:scale-105 focus:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
    : '';

  // Accessibility attributes
  const accessibilityProps = {
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    role: role || (interactive ? 'button' : 'region'),
    tabIndex: interactive ? (tabIndex ?? 0) : tabIndex,
    onKeyDown: interactive
      ? (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onKeyDown?.(e);
          }
        }
      : onKeyDown,
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${userTypeClasses} ${interactiveClasses} ${className}`}
      {...accessibilityProps}
      {...props}
    >
      {children}
    </div>
  );
};

// ============ GLASS BUTTON COMPONENT ============

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  userType,
  motion = 'spring',
  loading = false,
  disabled,
  ariaLabel,
  ariaDescribedBy,
  ariaPressed,
  ariaExpanded,
  focusRing = true,
  ...props
}) => {
  const baseClasses =
    'glass-button rounded-lg font-medium transition-all duration-200 backdrop-blur-md border';

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm min-h-[32px]',
    md: 'px-4 py-2 text-base min-h-[40px]',
    lg: 'px-6 py-3 text-lg min-h-[48px]',
  };

  // WCAG AA compliant color schemes
  const variantClasses = {
    primary: 'bg-white/25 border-white/35 text-gray-900 hover:bg-white/35 focus:bg-white/35',
    secondary: 'bg-white/15 border-white/25 text-gray-800 hover:bg-white/25 focus:bg-white/25',
    ghost: 'bg-transparent border-transparent text-gray-700 hover:bg-white/15 focus:bg-white/15',
  };

  const userTypeClasses = userType
    ? {
        photographer:
          'glass-photographer-button border-amber-300/50 text-amber-900 hover:border-amber-400/60',
        videographer:
          'glass-videographer-button border-blue-300/50 text-blue-900 hover:border-blue-400/60',
        musicProducer:
          'glass-music-producer-button border-purple-300/50 text-purple-900 hover:border-purple-400/60',
        admin: 'glass-admin-button border-gray-300/50 text-gray-900 hover:border-gray-400/60',
      }[userType]
    : '';

  const motionClasses = {
    spring: 'hover:scale-105 active:scale-95',
    elastic: 'hover:scale-110 active:scale-90',
    bounce: 'hover:scale-105 active:scale-98',
    smooth: 'hover:scale-102 active:scale-98',
  }[motion];

  const focusClasses = focusRing
    ? 'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
    : 'focus:outline-none';
  const disabledClasses =
    disabled || loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer';

  // Accessibility attributes
  const accessibilityProps = {
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    'aria-pressed': ariaPressed,
    'aria-expanded': ariaExpanded,
    'aria-disabled': disabled || loading,
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${userTypeClasses} ${motionClasses} ${focusClasses} ${disabledClasses} ${className}`}
      disabled={disabled || loading}
      {...accessibilityProps}
      {...props}
    >
      {loading ? (
        <div className="flex items-center justify-center" aria-live="polite">
          <div
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
            aria-hidden="true"
          />
          <span className="sr-only">Laster innhold...</span>
          Laster...
        </div>
      ) : (
        children
      )}
    </button>
  );
};

// ============ GLASS INPUT COMPONENT ============

export const GlassInput: React.FC<GlassInputProps> = ({
  className = '',
  variant = 'medium',
  userType,
  icon: Icon,
  error,
  label,
  ariaLabel,
  ariaDescribedBy,
  ariaInvalid,
  helperText,
  id,
  ...props
}) => {
  const inputId = id || `glass-input-${Math.random().toString(36).substr(2, 9)}`;
  const helperId = helperText ? `${inputId}-helper` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  const baseClasses =
    'glass-input w-full rounded-lg backdrop-blur-md transition-all duration-200 focus:outline-none focus:ring-2 border px-3 py-2';

  // WCAG AA compliant color schemes
  const variantClasses = {
    light: 'bg-white/20 border-white/30 placeholder-gray-600 text-gray-900',
    medium: 'bg-white/25 border-white/35 placeholder-gray-600 text-gray-900',
    heavy: 'bg-white/30 border-white/40 placeholder-gray-600 text-gray-900',
  };

  const userTypeClasses = userType
    ? {
        photographer: 'focus:ring-amber-400/50 focus:border-amber-400/50',
        videographer: 'focus:ring-blue-400/50 focus:border-blue-400/50',
        musicProducer: 'focus:ring-purple-400/50 focus:border-purple-400/50',
        admin: 'focus:ring-gray-400/50 focus:border-gray-400/50',
      }[userType]
    : 'focus:ring-blue-400/50 focus:border-blue-400/50';

  const errorClasses = error
    ? 'border-red-400/50 focus:ring-red-400/50 focus:border-red-400/50'
    : '';
  const iconPadding = Icon ? 'pl-10' : '';

  // Accessibility attributes
  const accessibilityProps = {
    id: inputId,
    'aria-label': ariaLabel || label,
    'aria-describedby': [ariaDescribedBy, helperId, errorId].filter(Boolean).join(' ') || undefined,
    'aria-invalid': ariaInvalid || !!error,
  };

  return (
    <div className="relative">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500"
            aria-hidden="true"
          />
        )}
        <input
          className={`${baseClasses} ${variantClasses[variant]} ${userTypeClasses} ${errorClasses} ${iconPadding} ${className}`}
          {...accessibilityProps}
          {...props}
        />
      </div>
      {helperText && !error && (
        <p id={helperId} className="mt-1 text-sm text-gray-600">
          {helperText}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

// ============ GLASS MODAL COMPONENT ============

export const GlassModal: React.FC<GlassModalProps> = ({
  children,
  isOpen,
  onClose,
  title,
  size = 'md',
  userType,
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const userTypeClasses = userType
    ? {
        photographer: 'glass-photographer',
        videographer: 'glass-videographer',
        musicProducer: 'glass-music-producer',
        admin: 'glass-admin',
      }[userType]
    : '';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <motion.div
        className={`relative glass-card ${sizeClasses[size]} ${userTypeClasses} w-full bg-white/10 border border-white/20 rounded-xl backdrop-blur-md`}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      >
        {title && (
          <div className="px-6 py-4 border-b border-white/20">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
      </motion.div>
    </motion.div>
  );
};

// ============ GLASS NAVIGATION COMPONENT ============

export const GlassNavigation: React.FC<GlassNavigationProps> = ({
  items,
  userType,
  orientation = 'horizontal',
  size = 'md',
}) => {
  const baseClasses = 'glass-navigation flex backdrop-blur-md rounded-lg border border-white/20';

  const orientationClasses =
    orientation === 'horizontal' ? 'flex-row space-x-1 p-1' : 'flex-col space-y-1 p-1';

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const userTypeClasses = userType
    ? {
        photographer: 'glass-photographer',
        videographer: 'glass-videographer',
        musicProducer: 'glass-music-producer',
        admin: 'glass-admin',
      }[userType]
    : '';

  return (
    <nav
      className={`${baseClasses} ${orientationClasses} ${sizeClasses[size]} ${userTypeClasses} bg-white/10`}
    >
      {items.map((item) => {
        const IconComponent = item.icon;
        const isActive = item.active;
        const isDisabled = item.disabled;

        const itemClasses = `
          flex items-center px-3 py-2 rounded-md transition-all duration-200
          ${isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `;

        const handleClick = () => {
          if (isDisabled) return;
          if (item.onClick) item.onClick();
        };

        return (
          <motion.div
            key={item.id}
            className={itemClasses}
            onClick={handleClick}
            whileHover={!isDisabled ? { scale: 1.02 } : {}}
            whileTap={!isDisabled ? { scale: 0.98 } : {}}
          >
            <IconComponent className="w-4 h-4 mr-2" />
            <span>{item.label}</span>
            {item.badge && item.badge > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </motion.div>
        );
      })}
    </nav>
  );
};

// ============ EXPORTS ============

export default {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassModal,
  GlassNavigation,
};
