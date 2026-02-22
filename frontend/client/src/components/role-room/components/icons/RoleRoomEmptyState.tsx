/**
 * RoleRoomEmptyState — Empty-state watermark component.
 *
 * Displays a large, semi-transparent PNG icon behind a title and optional
 * subtitle + CTA button. Designed for dark backgrounds.
 */

import React from 'react';
import { Box, Typography, Button, Fade } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

export interface RoleRoomEmptyStateProps {
  /** PNG icon source (imported via Vite) */
  iconSrc: string;
  /** Primary heading text */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Accent colour used for icon circle background, button, and dashed border */
  color?: string;
  /** CTA button label. Hidden when omitted. */
  buttonLabel?: string;
  /** CTA click handler */
  onAction?: () => void;
  /** Disable the CTA */
  disabled?: boolean;
  /** Optional extra content rendered below the standard layout */
  children?: React.ReactNode;
  /** Optional role for accessibility */
  role?: string;
  /** aria-label for the container */
  ariaLabel?: string;
  /** Icon size — default 80 */
  iconSize?: number | Record<string, number>;
}

export const RoleRoomEmptyState: React.FC<RoleRoomEmptyStateProps> = ({
  iconSrc,
  title,
  subtitle,
  color = 'rgba(255,255,255,0.5)',
  buttonLabel,
  onAction,
  disabled = false,
  children,
  role: ariaRole = 'status',
  ariaLabel,
  iconSize,
}) => {
  // Resolve icon dimensions (responsive-aware)
  const sizeVal = iconSize ?? { xs: 60, sm: 70, md: 65, lg: 80, xl: 104 };

  return (
    <Fade in timeout={500}>
      <Box
        role={ariaRole}
        aria-label={ariaLabel}
        sx={{
          textAlign: 'center',
          py: { xs: 4, sm: 6, md: 5, lg: 7, xl: 8 },
          px: { xs: 2, sm: 4 },
          bgcolor: `${color}08`,
          borderRadius: 3,
          border: `2px dashed ${color}33`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Watermark background icon (very low opacity) */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.04,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          <img
            src={iconSrc}
            alt=""
            aria-hidden
            draggable={false}
            style={{ width: 280, height: 280, objectFit: 'contain' }}
          />
        </Box>

        {/* Foreground content */}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          {/* Circular icon container */}
          <Box
            sx={{
              width: sizeVal,
              height: sizeVal,
              borderRadius: '50%',
              bgcolor: `${color}1A`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            }}
          >
            <img
              src={iconSrc}
              alt=""
              aria-hidden
              draggable={false}
              style={{
                width: '60%',
                height: '60%',
                objectFit: 'contain',
              }}
            />
          </Box>

          <Typography
            variant="h5"
            sx={{
              color: '#fff',
              fontWeight: 600,
              mb: { xs: 0.75, sm: 1 },
              fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.15rem', lg: '1.35rem', xl: '1.5rem' },
            }}
          >
            {title}
          </Typography>

          {subtitle && (
            <Typography
              variant="body1"
              sx={{
                color: 'rgba(255,255,255,0.87)',
                mb: { xs: 3, sm: 4 },
                maxWidth: { xs: '100%', sm: 400, md: 380, lg: 420, xl: 480 },
                mx: 'auto',
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
              }}
            >
              {subtitle}
            </Typography>
          )}

          {buttonLabel && onAction && (
            <Button
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              onClick={onAction}
              disabled={disabled}
              sx={{
                bgcolor: color,
                color: '#000',
                fontWeight: 600,
                px: 4,
                py: { xs: 1.25, sm: 1.5 },
                fontSize: { xs: '0.875rem', sm: '1rem' },
                minHeight: 44,
                '&:hover': { filter: 'brightness(0.9)', transform: 'translateY(-2px)' },
                '&:disabled': { bgcolor: `${color}4D`, color: 'rgba(0,0,0,0.5)' },
                transition: 'all 0.2s',
              }}
            >
              {buttonLabel}
            </Button>
          )}

          {children}
        </Box>
      </Box>
    </Fade>
  );
};

export default RoleRoomEmptyState;
