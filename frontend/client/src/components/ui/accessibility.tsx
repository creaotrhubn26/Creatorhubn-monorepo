/**
 * Accessibility Components and Utilities for CreatorHub Norge
 * Ensures WCAG 2.1 AA/AAA compliance across the platform
 * Norwegian language support with proper screen reader handling
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useRef, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Alert,
  AlertTitle,
  useTheme,
  alpha,
  Fade,
  Zoom,
} from '@mui/material';
import {
  VolumeUp as SpeakIcon,
  Accessibility as AccessibilityIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Contrast as ContrastIcon,
  TextIncrease as TextIncreaseIcon,
  TextDecrease as TextDecreaseIcon,
} from '@mui/icons-material';

// Screen reader announcement component
interface ScreenReaderProps {
  message: string;
  priority?: 'polite' | 'assertive' | 'off';
  delay?: number;
}

export function ScreenReaderAnnouncement({
  message,
  priority = 'polite',
  delay = 0,
}: ScreenReaderProps) {
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnnouncement(message);

      // Clear announcement after it's been read
      setTimeout(() => setAnnouncement(''), 100);
    }, delay);

    return () => clearTimeout(timer);
  }, [message, delay]);

  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      style={{
        position: 'absolute',
        left: '-10000px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden'
      }}
    >
      {announcement}
    </div>
  );
}

// Skip to main content link
export function SkipToMainContent() {
  const handleSkip = () => {
    const mainElement = document.getElementById('main-content');
    if (mainElement) {
      mainElement.focus();
      mainElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <Box
      component="a"
      href="#main-content"
      onClick={handleSkip}
      sx={{
        position: 'absolute',
        top: -40,
        left: 6,
        backgroundColor: 'primary.main',
        color: 'primary.contrastText',
        padding: '8px 16px',
        borderRadius: 1,
        textDecoration: 'none',
        fontSize: '0.875rem',
        fontWeight: 500,
        zIndex: 9999,
        transition: 'top 0.2s ease-in-out',
        '&:focus': {
          top: 6,
          outline: '2px solid',
          outlineColor: 'secondary.main',
          outlineOffset: '2px',
        }
      }}
    >
      Hopp til hovedinnhold
    </Box>
  );
}

// High contrast mode toggle
export function HighContrastToggle() {
  const [highContrast, setHighContrast] = useState(false);
  const theme = useTheme();
  
  // Theming system
  const theming = useTheming('photographer');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/user/kv/high-contrast-mode', { credentials: 'include' });
        const j = res.ok ? await res.json().catch(() => null) : null;
        const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
        const stored = v ?? localStorage.getItem('high-contrast-mode');
        if (stored === 'true' || stored === true) {
          setHighContrast(true);
          document.body.classList.add('high-contrast-mode');
        }
      } catch {
        const stored = localStorage.getItem('high-contrast-mode');
        if (stored === 'true') {
          setHighContrast(true);
          document.body.classList.add('high-contrast-mode');
        }
      }
    })();
  }, []);

  const toggleHighContrast = () => {
    const newValue = !highContrast;
    setHighContrast(newValue);

    if (newValue) {
      document.body.classList.add('high-contrast-mode');
      fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: 'high-contrast-mode', value: 'true' })
      }).catch(() => {});
      localStorage.setItem('high-contrast-mode','true');
    } else {
      document.body.classList.remove('high-contrast-mode');
      fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: 'high-contrast-mode', value: 'false' })
      }).catch(() => {});
      localStorage.setItem('high-contrast-mode','false');
    }
};

  return (
    <Tooltip title="Høy kontrast modus" placement="bottom">
      <IconButton
        onClick={toggleHighContrast}
        aria-label={highContrast ? 'Deaktiver høy kontrast' : 'Aktiver høy kontrast'}
        sx={{
          color: highContrast ? 'warning.main' : 'action.active',
          '&:focus': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: '2px',
          }
        }}
      >
        <ContrastIcon />
      </IconButton>
    </Tooltip>
  );
}

// Text size adjustment
export function TextSizeControls() {
  const [textSize, setTextSize] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/user/kv/text-size-multiplier', { credentials: 'include' });
        const j = res.ok ? await res.json().catch(() => null) : null;
        const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
        const stored = v ?? localStorage.getItem('text-size-multiplier');
        if (stored) {
          const size = parseFloat(stored as string);
          setTextSize(size);
          document.documentElement.style.fontSize = `${16 * size}px`;
        }
      } catch {
        const stored = localStorage.getItem('text-size-multiplier');
        if (stored) {
          const size = parseFloat(stored);
          setTextSize(size);
          document.documentElement.style.fontSize = `${16 * size}px`;
        }
      }
    })();
  }, []);

  const adjustTextSize = (delta: number) => {
    const newSize = Math.max(0.8, Math.min(2, textSize + delta));
    setTextSize(newSize);
    document.documentElement.style.fontSize = `${16 * newSize}px`;
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'text-size-multiplier', value: newSize.toString() })
    }).catch(() => {});
    localStorage.setItem('text-size-multiplier', newSize.toString());
};

  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
      <Tooltip title="Gjør tekst mindre">
        <span>
          <IconButton
            onClick={() => adjustTextSize(-0.1)}
            disabled={textSize <= 0.8}
            aria-label="Gjør tekst mindre"
            size="small"
            sx={{
              '&:focus': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }
            }}
          >
            <TextDecreaseIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

        <Typography variant="body2" sx={{ minWidth: 40, textAlign: 'center', fontSize: '0.75rem' }}>
        {Math.round(textSize * 100)}%
      </Typography>

      <Tooltip title="Gjør tekst større">
        <span>
          <IconButton
            onClick={() => adjustTextSize(0.1)}
            disabled={textSize >= 2}
            aria-label="Gjør tekst større"
            size="small"
            sx={{
              '&:focus': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }
            }}
          >
            <TextIncreaseIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

// Keyboard navigation helper
export function FocusTrap({
  children,
  active = true,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'a[href], button: not([disabled]), textarea: not([disabled]), input: not([disabled]), select: not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [active]);

  return <div ref={containerRef}>{children}</div>;
}

// Accessible form field with proper labeling
interface AccessibleFieldProps {
  label: string;
  id: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  helperText?: string;
}

export function AccessibleField({
  label,
  id,
  error,
  required,
  children,
  helperText,
}: AccessibleFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  const helperId = helperText ? `${id}-helper` : undefined;

  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        component="label"
        htmlFor={id}
        variant="body2"
        sx={{
          display: 'block',
          mb: 0.5,
          fontWeight: 500,
          color: error ? 'error.main' : 'text.primary'
        }}
      >
        {label}
        {required && (
          <Typography
            component="span"
            color="error.main"
            sx={{ ml: 0.5 }}
            aria-label="påkrevd felt"
          >
            *
          </Typography>
        )}
      </Typography>

      <Box
        sx={{
          '& input, & textarea, & select': {
            '&:focus': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: '2px',
            },
          }
        }}
      >
        {React.cloneElement(children as React.ReactElement, {
          id,
          'aria-required': required,
          'aria-invalid': !!error,
          'aria-describedby': [errorId, helperId].filter(Boolean).join(' ') || undefined,
        })}
      </Box>

      {helperText && (
        <Typography
          id={helperId}
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.5, display: 'block' }}
        >
          {helperText}
        </Typography>
      )}

      {error && (
        <Typography
          id={errorId}
          variant="caption"
          color="error.main"
          sx={{ mt: 0.5, display: 'block' }}
          role="alert"
        >
          {error}
        </Typography>
      )}
    </Box>
  );
}

// Accessible modal/dialog wrapper
interface AccessibleModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function AccessibleModal({
  open,
  onClose,
  title,
  children,
  maxWidth = '500px',
}: AccessibleModalProps) {
  const titleId = `modal-title-${Date.now()}`;

  useEffect(() => {
    if (open) {
      // Trap focus and prevent body scroll
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  return (
    <Fade in={open}>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: alpha('#000', 0.5),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1300,
          p: 2
        }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <FocusTrap active={open}>
          <Box
            sx={{
              backgroundColor: 'background.paper',
              borderRadius: 2,
              maxWidth,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              p: 3,
              '&:focus': {
                outline: 'none',
              }
            }}
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
          >
            <Typography id={titleId} variant="h6" component="h2" sx={{ mb: 2, fontWeight: 600 }}>
              {title}
            </Typography>

            {children}
          </Box>
        </FocusTrap>
      </Box>
    </Fade>
  );
}

// Color contrast checker (development helper)
export function checkColorContrast(
  foreground: string,
  background: string,
): {
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
} {
  // Simple contrast ratio calculation
  const getLuminance = (color: string): number => {
    // This is a simplified version - in production, use a proper color library
    const rgb = color.match(/\d+/g);
    if (!rgb) return 0;

    const [rgb] = rgb.map((x) => {
      const val = parseInt(x) / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);

  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  return {
    ratio: Math.round(ratio * 100) / 100,
    passesAA: ratio >= 4.5,
    passesAAA: ratio >= 7,
};
}

// Accessibility toolbar
export function AccessibilityToolbar() {
  const [open, setOpen] = useState(false);

  return (
    <Box sx={{ position: 'fixed', top: 20, right: 20, zIndex: 1200 }}>
      <Tooltip title="Tilgjengelighetsverktøy" placement="left">
        <IconButton
          onClick={() => setOpen(!open)}
          sx={{
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
            '&:focus': {
              outline: '2px solid',
              outlineColor: 'secondary.main',
              outlineOffset: '2px',
            }
          }}
          aria-label="Åpne tilgjengelighetsverktøy"
          aria-expanded={open}
        >
          <AccessibilityIcon />
        </IconButton>
      </Tooltip>

      <Zoom in={open}>
        <Box
          sx={{
            position: 'absolute',
            top: '100%',
            right: 0,
            mt: 1,
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            boxShadow: 3,
            minWidth: 250
          }}
          role="menu"
          aria-label="Tilgjengelighetsmenå"
        >
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Tilgjengelighetsinnstillinger
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Tekststørrelse
              </Typography>
              <TextSizeControls />
            </Box>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <Typography variant="body2">Høy kontrast</Typography>
              <HighContrastToggle />
            </Box>
          </Box>
        </Box>
      </Zoom>
    </Box>
  );
}
