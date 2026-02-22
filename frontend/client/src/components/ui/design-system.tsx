/**
 * Design System Components for CreatorHub Norge
 * Standardizes colors, typography, spacing, and UI patterns
 * Material UI compliant with Norwegian market focus
 */

import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Avatar,
  Badge,
  IconButton,
  Divider,
  useTheme,
  alpha,
  styled,
} from '@mui/material';
import {
  Star as StarIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

// Standardized spacing values
export const SPACING = {
  xs: 4,    // 4px
  sm: 8,    // 8px
  md: 16,   // 16px
  lg: 24,   // 24px
  xl: 32,   // 32px
  xxl: 48,  // 48px
} as const;

// Standardized color palette extensions
export const COLORS = {
  success: {
    light: '#4caf50',
    main: '#2e7d32',
    dark: '#1b5e20',
},
  warning: {
    light: '#ff9800',
    main: '#f57c00',
    dark: '#e65100',
},
  error: {
    light: '#f44336',
    main: '#d32f2f',
    dark: '#c62828',
},
  info: {
    light: '#2196f3',
    main: '#1976d2',
    dark: '#0d47a1',
},
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
}
} as const;

// Standardized typography components
interface StandardTypographyProps {
  children: React.ReactNode;
  color?: string;
  align?: 'left' | 'center' | 'right';
  gutterBottom?: boolean;
}

export function PageTitle({ children, color = 'text.primary', align = 'left', gutterBottom = true }: StandardTypographyProps) {
  return (
    <Typography variant="h3"
      component="h1"
      color={color}
      align={align}
      gutterBottom={gutterBottom}
      sx={{
        fontWeight: 700,
        fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
        lineHeight: 1.2,
        mb: gutterBottom ? SPACING.lg / 8 : 0
      }}
    >
      {children}
    </Typography>
  );
}

export function SectionTitle({ children, color = 'text.primary', align = 'left', gutterBottom = true }: StandardTypographyProps) {
  return (
    <Typography variant="h4"
      component="h2"
      color={color}
      align={align}
      gutterBottom={gutterBottom}
      sx={{
        fontWeight: 600,
        fontSize: { xs: '1.5rem', sm: '2rem' },
        lineHeight: 1.3,
        mb: gutterBottom ? SPACING.md / 8 : 0
      }}
    >
      {children}
    </Typography>
  );
}

export function SubsectionTitle({ children, color = 'text.primary', align = 'left', gutterBottom = true }: StandardTypographyProps) {
  return (
    <Typography variant="h5"
      component="h3"
      color={color}
      align={align}
      gutterBottom={gutterBottom}
      sx={{
        fontWeight: 500,
        fontSize: { xs: '1.25rem', sm: '1.5rem' },
        mb: gutterBottom ? SPACING.sm / 8 : 0
      }}
    >
      {children}
    </Typography>
  );
}

export function BodyText({ children, color = 'text.primary', align = 'left', gutterBottom = false }: StandardTypographyProps) {
  return (
    <Typography
      variant="body1"
      color={color}
      align={align}
      gutterBottom={gutterBottom}
      sx={{
        fontSize: '1rem',
        lineHeight: 1.6,
        mb: gutterBottom ? SPACING.sm / 8 : 0
      }}
    >
      {children}
    </Typography>
  );
}

export function Caption({ children, color = 'text.secondary', align = 'left' }: StandardTypographyProps) {
  return (
    <Typography
      variant="caption"
      color={color}
      align={align}
      sx={{
        fontSize: '0.75rem',
        lineHeight: 1.4,
        fontWeight: 400
      }}
    >
      {children}
    </Typography>
  );
}

// Standardized card component
interface StandardCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  elevated?: boolean;
  interactive?: boolean;
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StandardCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== 'elevated' && prop !== 'interactive',
})<{ elevated?: boolean; interactive?: boolean }>(({ theme, elevated, interactive }) => ({
  borderRadius: theme.shape.borderRadius * 2,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: elevated ? theme.shadows[4] : theme.shadows[1],
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  
  ...(interactive && {
    cursor: 'pointer',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows[8],
      borderColor: theme.palette.primary.main,
    },
  }),
}));

export function CreatorCard({ 
  children, 
  title, 
  subtitle, 
  action, 
  elevated = false, 
  interactive = false,
  padding = 'md',
  className 
}: StandardCardProps) {
  const paddingMap = {
    sm: SPACING.sm / 8,
    md: SPACING.md / 8,
    lg: SPACING.lg / 8,
};

  return (
    <StandardCard elevated={elevated} interactive={interactive} className={className}>
      {(title || action) && (
        <CardHeader
          title={title && <SubsectionTitle gutterBottom={false}>{title}</SubsectionTitle>}
          subheader={subtitle && <Caption>{subtitle}</Caption>}
          action={action}
          sx={{ pb: title || subtitle ? 1 : 0 }}
        />
      )}
      <CardContent sx={{ pt: title || subtitle ? 1 : paddingMap[padding] }}>
        {children}
      </CardContent>
    </StandardCard>
  );
}

// Standardized button variants
interface StandardButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export function StandardButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  startIcon,
  endIcon,
}: StandardButtonProps) {
  const theme = useTheme();
  
  // Theming system
  const theming = useTheming('prototype_tester');

  const getVariantProps = () => {
    switch (variant) {
      case 'primary':
        return {
          variant: 'contained' as const,
          color: 'primary' as const,
        };
      case 'secondary':
        return {
          variant: 'contained' as const,
          color: 'secondary' as const,
        };
      case 'outline':
        return {
          variant: 'outlined' as const,
          color: 'primary' as const,
        };
      case 'ghost':
        return {
          variant: 'text' as const,
          color: 'primary' as const,
        };
      case 'danger':
        return {
          variant: 'contained' as const,
          sx: {
            backgroundColor: COLORS.error.main,
            color: 'white',
            '&:hover': {
              backgroundColor: COLORS.error.dark,
            },
          },
        };
      default: return {
          variant: 'contained' as const,
          color: 'primary' as const,
        };
    }
  };

  const getSizeProps = () => {
    switch (size) {
      case 'sm':
        return { size: 'small' as const };
      case 'lg':
        return { size: 'large' as const };
      default: return { size: 'medium' as const };
    }
  };

  return (
    <Button
      {...getVariantProps()}
      {...getSizeProps()}
      onClick={onClick}
      disabled={disabled}
      fullWidth={fullWidth}
      startIcon={startIcon}
      endIcon={endIcon}
      sx={{
        borderRadius: 2,
        textTransform: 'none',
        fontWeight: 500,
        px: { sm: 2, md: 3, lg: 4 }[size],
        py: { sm: 0.75, md: 1, lg: 1.25 }[size],
        '&:focus': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: '2px',
        },
        ...getVariantProps().sx
      }}
    >
      {children}
    </Button>
  );
}

// Standardized status indicators
interface StatusIndicatorProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  text: string;
  size?: 'sm' | 'md';
}

export function StatusIndicator({ status, text, size = 'md' }: StatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'success':
        return { color: COLORS.success.main, icon: CheckCircleIcon };
      case 'warning':
        return { color: COLORS.warning.main, icon: WarningIcon };
      case 'error':
        return { color: COLORS.error.main, icon: ErrorIcon };
      case 'info':
        return { color: COLORS.info.main, icon: InfoIcon };
      default: return { color: COLORS.neutral[500], icon: InfoIcon };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  return (
    <Chip
      icon={<IconComponent />}
      label={text}
      size={size === 'sm' ? 'small' : 'medium'}
      sx={{
        backgroundColor: alpha(config.color, 0.1),
        color: config.color,
        borderColor: config.color,
        '& .MuiChip-icon': {
          color: config.color,
        }
      }}
    />
  );
}

// Standardized metric display
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
}

export function MetricCard({ title, value, subtitle, trend, trendValue, icon }: MetricCardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return COLORS.success.main;
      case 'down':
        return COLORS.error.main;
      default: return COLORS.neutral[500];
    }
  };

  return (
    <CreatorCard elevated interactive padding="lg">
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ flex: 1 }}>
          <Caption gutterBottom>{title}</Caption>
          <Typography variant="h4"
            component="div"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1.5rem', sm: '2rem' },
              mb: 0.5,
              color: 'text.primary'
            }}
          >
            {value}
          </Typography>
          {subtitle && <Caption>{subtitle}</Caption>}
          
          {trend && trendValue && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 0.5 }}>
              <TrendingUpIcon 
                sx={{ 
                  fontSize: '1rem', 
                  color: getTrendColor(),
                  transform: trend === 'down' ? 'rotate(180deg)' : 'none'
                }}
              />
              <Caption color={getTrendColor()}>
                {trendValue}
              </Caption>
            </Box>
          )}
        </Box>
        
        {icon && (
          <Box
            sx={{
              p: 1.5,
              backgroundColor: alpha('#000', 0.04),
              borderRadius: 2,
              color: 'primary.main'
            }}
          >
            {icon}
          </Box>
        )}
      </Box>
    </CreatorCard>
  );
}

// Standardized section divider
export function SectionDivider({ 
  spacing = 'md' 
}: { 
  spacing?: 'sm' | 'md' | 'lg' 
}) {
  const spacingMap = {
    sm: SPACING.sm / 8,
    md: SPACING.md / 8,
    lg: SPACING.lg / 8,
};

  return (
    <Divider 
      sx={{ 
        my: spacingMap[spacing],
        borderColor: alpha('#000', 0.08)
      }}
    />
  );
}

// Standardized avatar with status
interface StatusAvatarProps {
  src?: string;
  alt: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  status?: 'online' | 'offline' | 'busy' | 'away';
  showBadge?: boolean;
}

export function StatusAvatar({ 
  src, 
  alt, 
  name, 
  size = 'md', 
  status = 'offline',
  showBadge = true 
}: StatusAvatarProps) {
  const sizeMap = {
    sm: 32,
    md: 40,
    lg: 56,
  };

  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return COLORS.success.main;
      case 'busy':
        return COLORS.error.main;
      case 'away':
        return COLORS.warning.main;
      default: return COLORS.neutral[400];
    }
  };

  const avatar = (
    <Avatar
      src={src}
      alt={alt}
      sx={{
        width: sizeMap[size],
        height: sizeMap[size],
        fontSize: size === 'sm' ? '0.875rem' : size === 'lg' ? '1.5rem' : '1rem',
        fontWeight: 500
      }}
    >
      {name ? name.charAt(0).toUpperCase() : alt.charAt(0).toUpperCase()}
    </Avatar>
  );

  if (!showBadge) return avatar;

  return (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      badgeContent={
        <Box
          sx={{
            width: size === 'sm' ? 8 : size === 'lg' ? 14 : 10,
            height: size === 'sm' ? 8 : size === 'lg' ? 14 : 10,
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
            border: '2px solid',
            borderColor: 'background.paper'
          }}
        />
      }
    >
      {avatar}
    </Badge>
  );
}