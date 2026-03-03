/**
 * TabletUI - Tablet-optimized UI components for Virtual Studio
 * 
 * Components:
 * - TabletToolbar: Floating toolbar with touch-friendly buttons
 * - TabletSidebar: Collapsible side panel with gestures
 * - TabletBottomSheet: iOS-style bottom sheet
 * - TabletContextMenu: Long-press context menu
 * - TabletButton: Touch-optimized button
 * - TabletSlider: Large touch slider
 * - GestureView: Container with common gesture support
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
  forwardRef,
} from 'react';
import {
  Box,
  Paper,
  IconButton,
  Button,
  Slider,
  Drawer,
  SwipeableDrawer,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Stack,
  Divider,
  Fade,
  Zoom,
  Collapse,
  Portal,
} from '@mui/material';
import type { ButtonProps } from '@mui/material/Button';
import type { SliderProps } from '@mui/material/Slider';
import {
  DragHandle,
  Close,
  ChevronLeft,
  ChevronRight,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { useTabletSupport } from '../../providers/TabletSupportProvider';
import { useTouchGestures, Point } from '../../hooks/useTouchGestures';

// =============================================================================
// Animations
// =============================================================================

const slideUpKeyframes = keyframes`
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
`;

const pulseKeyframes = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
`;

// =============================================================================
// Tablet Button
// =============================================================================

const StyledTabletButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'touchSize',
})<{ touchSize?: number }>(({ touchSize = 44 }) => ({
  minWidth: touchSize,
  minHeight: touchSize,
  borderRadius: 8,
  padding: '8px 16px',
  touchAction: 'manipulation', // Prevent zoom on double-tap
}));

export interface TabletButtonProps extends ButtonProps {
  /** Ensures minimum touch target size */
  ensureTouchTarget?: boolean;
}

export const TabletButton = forwardRef<HTMLButtonElement, TabletButtonProps>(
  ({ ensureTouchTarget = true, children, ...props }, ref) => {
    const { getTouchTargetSize, shouldUseTouch } = useTabletSupport();
    const touchSize = ensureTouchTarget ? getTouchTargetSize(44) : undefined;
    
    return (
      <StyledTabletButton
        ref={ref}
        touchSize={touchSize}
        {...props}
      >
        {children}
      </StyledTabletButton>
    );
  }
);

TabletButton.displayName = 'TabletButton';

// =============================================================================
// Tablet Icon Button
// =============================================================================

const StyledTabletIconButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'touchSize',
})<{ touchSize?: number }>(({ touchSize = 44 }) => ({
  width: touchSize,
  height: touchSize,
  touchAction: 'manipulation',
}));

export interface TabletIconButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  color?: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  size?: 'small' | 'medium' | 'large';
  tooltip?: string;
}

export const TabletIconButton: React.FC<TabletIconButtonProps> = ({
  children,
  onClick,
  disabled,
  color = 'default',
  size = 'medium',
  tooltip,
}) => {
  const { getTouchTargetSize } = useTabletSupport();
  const baseSize = size === 'small' ? 32 : size === 'large' ? 56 : 44;
  const touchSize = getTouchTargetSize(baseSize);
  
  const button = (
    <StyledTabletIconButton
      touchSize={touchSize}
      onClick={onClick}
      disabled={disabled}
      color={color}
    >
      {children}
    </StyledTabletIconButton>
  );
  
  // Note: Would use Tooltip but avoiding import complexity
  return button;
};

// =============================================================================
// Tablet Slider
// =============================================================================

const StyledTabletSlider = styled(Slider)({
  '& .MuiSlider-thumb': {
    width: 28,
    height: 28 , '&:before': {
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    },
  }, '& .MuiSlider-track': {
    height: 8,
    borderRadius: 4,
  }, '& .MuiSlider-rail': {
    height: 8,
    borderRadius: 4,
  },
});

export interface TabletSliderProps extends SliderProps {
  label?: string;
  showValue?: boolean;
}

export const TabletSlider: React.FC<TabletSliderProps> = ({
  label,
  showValue = true,
  value,
  ...props
}) => {
  return (
    <Box sx={{ width: '100%' }}>
      {(label || showValue) && (
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
          {label && <Typography variant="caption">{label}</Typography>}
          {showValue && (
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
              {Array.isArray(value) ? value.join(' - ') : value}
            </Typography>
          )}
        </Stack>
      )}
      <StyledTabletSlider value={value} {...props} />
    </Box>
  );
};

// =============================================================================
// Tablet Toolbar
// =============================================================================

const ToolbarContainer = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'position',
})<{ position?: 'top' | 'bottom' | 'floating' }>(({ position = 'floating' }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  borderRadius: position === 'floating' ? 24 : 0,
  backgroundColor: 'rgba(26, 26, 46, 0.95)',
  backdropFilter: 'blur(8px)',
  
  ...(position === 'floating' && {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  }),
  
  ...(position === 'top' && {
    position: 'sticky',
    top: 0,
    zIndex: 1,
  }),
  
  ...(position === 'bottom' && {
    position: 'sticky',
    bottom: 0,
    zIndex: 1,
  }),
}));

export interface TabletToolbarProps {
  children: ReactNode;
  position?: 'top' | 'bottom' | 'floating';
  visible?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export const TabletToolbar: React.FC<TabletToolbarProps> = ({
  children,
  position,
  visible = true,
  autoHide = false,
  autoHideDelay = 3000,
}) => {
  const { layout } = useTabletSupport();
  const [isVisible, setIsVisible] = useState(visible);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);
  
  useEffect(() => {
    if (!autoHide) return;
    
    const resetTimer = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setIsVisible(true);
      hideTimerRef.current = setTimeout(() => setIsVisible(false), autoHideDelay);
    };
    
    window.addEventListener('touchstart', resetTimer);
    window.addEventListener('mousemove', resetTimer);
    
    return () => {
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('mousemove', resetTimer);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [autoHide, autoHideDelay]);
  
  return (
    <Fade in={isVisible}>
      <ToolbarContainer position={position || layout.toolbarPosition} elevation={8}>
        {children}
      </ToolbarContainer>
    </Fade>
  );
};

// =============================================================================
// Tablet Sidebar
// =============================================================================

const SidebarContainer = styled(Box, {
  shouldForwardProp: (prop) => !['position','width','isOpen'].includes(prop as string),
})<{ position: 'left' | 'right'; width: number; isOpen: boolean }>(
  ({ position, width, isOpen }) => ({
    position: 'fixed',
    top: 0,
    bottom: 0,
    [position]: 0,
    width: width,
    backgroundColor: '#1a1a2e',
    borderRight: position === 'left' ? '1px solid rgba(255,255,255,0.1)' : 'none',
    borderLeft: position === 'right' ? '1px solid rgba(255,255,255,0.1)' : 'none',
    transform: isOpen ? 'translateX(0)' : `translateX(${position === 'left' ? '-100%' : '100%'})`,
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
  })
);

const SidebarHandle = styled(Box)({
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 24,
  height: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255,255,255,0.1)',
  borderRadius: 12,
  cursor: 'pointer',
});

export interface TabletSidebarProps {
  children: ReactNode;
  position?: 'left' | 'right';
  width?: number;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  header?: ReactNode;
  footer?: ReactNode;
}

export const TabletSidebar: React.FC<TabletSidebarProps> = ({
  children,
  position = 'left',
  width = 320,
  isOpen: controlledIsOpen,
  onOpenChange,
  header,
  footer,
}) => {
  const { layout, isTablet, gestureConfig } = useTabletSupport();
  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const isOpen = controlledIsOpen ?? internalIsOpen;
  
  const handleToggle = useCallback(() => {
    const newValue = !isOpen;
    setInternalIsOpen(newValue);
    onOpenChange?.(newValue);
  }, [isOpen, onOpenChange]);
  
  // Swipe to open/close
  const { ref: gestureRef } = useTouchGestures({
    onSwipeLeft: () => {
      if (position === 'left' && isOpen) handleToggle();
      if (position === 'right' && !isOpen) handleToggle();
    },
    onSwipeRight: () => {
      if (position === 'left' && !isOpen) handleToggle();
      if (position === 'right' && isOpen) handleToggle();
    },
  }, {
    enableSwipe: isTablet && gestureConfig.enableSwipeNavigation,
    enablePinch: false,
    enablePan: false,
    enableLongPress: false,
    enableDoubleTap: false,
    swipeThreshold: gestureConfig.swipeThreshold,
  });
  
  const actualWidth = isTablet ? Math.min(width, layout.panelWidth) : width;
  
  return (
    <>
      <SidebarContainer
        ref={gestureRef as React.RefObject<HTMLDivElement>}
        position={position}
        width={actualWidth}
        isOpen={isOpen}
      >
        {header && (
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {header}
          </Box>
        )}
        
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {children}
        </Box>
        
        {footer && (
          <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {footer}
          </Box>
        )}
        
        {/* Toggle handle */}
        <SidebarHandle
          onClick={handleToggle}
          sx={{
            [position === 'left' ? 'right' : 'left']: -24}}
        >
          {position === 'left' ? (
            isOpen ? <ChevronLeft /> : <ChevronRight />
          ) : (
            isOpen ? <ChevronRight /> : <ChevronLeft />
          )}
        </SidebarHandle>
      </SidebarContainer>
      
      {/* Overlay when open on tablet */}
      {isTablet && isOpen && (
        <Box
          onClick={handleToggle}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 9}}
        />
      )}
    </>
  );
};

// =============================================================================
// Tablet Bottom Sheet
// =============================================================================

const BottomSheetContainer = styled(Paper, {
  shouldForwardProp: (prop) => !['height', 'isOpen'].includes(prop as string),
})<{ height: string | number; isOpen: boolean }>(({ height, isOpen }) => ({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  height: typeof height === 'number' ? height : height,
  maxHeight: '90vh',
  backgroundColor: '#1a1a2e',
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
  transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  zIndex: 20,
  display: 'flex',
  flexDirection: 'column',
}));

const BottomSheetHandle = styled(Box)({
  width: 40,
  height: 4,
  borderRadius: 2,
  backgroundColor: 'rgba(255,255,255,0.3)',
  margin: '12px auto',
});

export interface TabletBottomSheetProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  height?: string | number;
  title?: string;
  showHandle?: boolean;
}

export const TabletBottomSheet: React.FC<TabletBottomSheetProps> = ({
  children,
  isOpen,
  onClose,
  height = '50vh',
  title,
  showHandle = true,
}) => {
  const { gestureConfig } = useTabletSupport();
  
  // Swipe down to close
  const { ref: gestureRef } = useTouchGestures({
    onSwipeDown: onClose,
  }, {
    enableSwipe: gestureConfig.enableSwipeNavigation,
    enablePinch: false,
    enablePan: false,
    enableLongPress: false,
    enableDoubleTap: false,
    swipeThreshold: 50,
  });
  
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <Box
          onClick={onClose}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 19}}
        />
      )}
      
      <BottomSheetContainer
        ref={gestureRef as React.RefObject<HTMLDivElement>}
        height={height}
        isOpen={isOpen}
        elevation={16}
      >
        {showHandle && <BottomSheetHandle />}
        
        {title && (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 2, pb: 2 }}
          >
            <Typography variant="h6">{title}</Typography>
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Stack>
        )}
        
        <Box sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2 }}>
          {children}
        </Box>
      </BottomSheetContainer>
    </>
  );
};

// =============================================================================
// Tablet Context Menu (Long Press)
// =============================================================================

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  divider?: boolean;
  danger?: boolean;
}

export interface TabletContextMenuProps {
  items: ContextMenuItem[];
  children: ReactNode;
  disabled?: boolean;
}

export const TabletContextMenu: React.FC<TabletContextMenuProps> = ({
  items,
  children,
  disabled = false,
}) => {
  const { gestureConfig, isDesktop } = useTabletSupport();
  const [anchorPosition, setAnchorPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Long press handler
  const { ref: gestureRef } = useTouchGestures({
    onLongPress: (point) => {
      if (!disabled) {
        setAnchorPosition({ x: point.x, y: point.y });
      }
    },
  }, {
    enableLongPress: !disabled && gestureConfig.enableLongPressMenu,
    enablePinch: false,
    enablePan: false,
    enableSwipe: false,
    enableDoubleTap: false,
    longPressDuration: gestureConfig.longPressDuration,
  });
  
  // Right-click handler for desktop
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (isDesktop && !disabled) {
      e.preventDefault();
      setAnchorPosition({ x: e.clientX, y: e.clientY });
    }
  }, [isDesktop, disabled]);
  
  const handleClose = useCallback(() => {
    setAnchorPosition(null);
  }, []);
  
  return (
    <>
      <Box
        ref={(el) => {
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          (gestureRef as React.MutableRefObject<HTMLElement | null>).current = el;
        }}
        onContextMenu={handleContextMenu}
        sx={{ display: 'contents' }}
      >
        {children}
      </Box>
      
      <Menu
        open={Boolean(anchorPosition)}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition ? { top: anchorPosition.y, left: anchorPosition.x } : undefined}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            minWidth: 200,
          }}}
      >
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            {item.divider && index > 0 && <Divider sx={{ my: 0.5 }} />}
            <MenuItem
              onClick={() => {
                item.onClick();
                handleClose();
              }}
              disabled={item.disabled}
              sx={{ color: item.danger ? 'error.main' : undefined }}
            >
              {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
              <ListItemText>{item.label}</ListItemText>
            </MenuItem>
          </React.Fragment>
        ))}
      </Menu>
    </>
  );
};

// =============================================================================
// Gesture View
// =============================================================================

export interface GestureViewProps {
  children: ReactNode;
  onPinchZoom?: (scale: number) => void;
  onPan?: (delta: { x: number; y: number }) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: (point: Point) => void;
  style?: React.CSSProperties;
  className?: string;
}

export const GestureView: React.FC<GestureViewProps> = ({
  children,
  onPinchZoom,
  onPan,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onDoubleTap,
  onLongPress,
  style,
  className,
}) => {
  const { gestureConfig, shouldUseTouch } = useTabletSupport();
  const isTouch = shouldUseTouch();
  
  const { ref: gestureRef } = useTouchGestures(
    isTouch ? {
      onPinch: onPinchZoom,
      onPan: (delta) => onPan?.(delta),
      onSwipeLeft,
      onSwipeRight,
      onSwipeUp,
      onSwipeDown,
      onDoubleTap,
      onLongPress,
    } : {},
    {
      enablePinch: isTouch && gestureConfig.enablePinchZoom && !!onPinchZoom,
      enablePan: isTouch && gestureConfig.enableTwoFingerPan && !!onPan,
      enableSwipe: isTouch && gestureConfig.enableSwipeNavigation && !!(onSwipeLeft || onSwipeRight || onSwipeUp || onSwipeDown),
      enableDoubleTap: isTouch && gestureConfig.enableDoubleTap && !!onDoubleTap,
      enableLongPress: isTouch && gestureConfig.enableLongPressMenu && !!onLongPress,
      swipeThreshold: gestureConfig.swipeThreshold,
      longPressDuration: gestureConfig.longPressDuration,
    }
  );
  
  return (
    <Box
      ref={gestureRef as React.RefObject<HTMLDivElement>}
      style={style}
      className={className}
      sx={{ touchAction: isTouch ? 'none' : 'auto' }}
    >
      {children}
    </Box>
  );
};

export default {
  TabletButton,
  TabletIconButton,
  TabletSlider,
  TabletToolbar,
  TabletSidebar,
  TabletBottomSheet,
  TabletContextMenu,
  GestureView,
};
