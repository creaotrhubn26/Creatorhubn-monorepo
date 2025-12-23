/**
 * AccessibleComponents - WCAG 2.2 Compliant UI Components
 * 
 * Provides accessible versions of common UI patterns:
 * - AccessibleButton: Button with proper ARIA and keyboard support
 * - AccessibleSlider: Slider with keyboard navigation and announcements
 * - AccessibleTabs: Tab panel with arrow key navigation
 * - AccessibleDialog: Modal with focus trapping
 * - AccessibleList: List with keyboard navigation
 * - AccessibleDraggable: Drag with keyboard alternative (WCAG 2.5.7)
 * - AccessibleTooltip: Tooltip accessible to keyboard/screen readers
 */

import React, {
  useCallback,
  useRef,
  useState,
  useEffect,
  forwardRef,
  ReactNode,
  KeyboardEvent,
  MouseEvent,
} from 'react';
import {
  Box,
  Button,
  ButtonProps,
  Slider,
  SliderProps,
  Tabs,
  TabsProps,
  Tab,
  TabProps,
  Dialog,
  DialogProps,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  IconButtonProps,
  Tooltip,
  TooltipProps,
  Typography,
  List,
  ListItem,
  ListItemButton,
  Paper,
  Fade,
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowUpward,
  ArrowDownward,
  DragIndicator,
  KeyboardArrowUp,
  KeyboardArrowDown,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from '@mui/icons-material';
import { useAccessibility, useFocusTrap, useAnnounce, VisuallyHidden } from '../../providers/AccessibilityProvider';

// ============================================================================
// Constants
// ============================================================================

// WCAG 2.5.8 minimum target size
const MIN_TARGET_SIZE = 44;

// Focus outline styles for WCAG 2.4.7
const FOCUS_STYLES = {
  outline: '3px solid #2196f3',
  outlineOffset: '2px',
};

// ============================================================================
// AccessibleButton
// ============================================================================

interface AccessibleButtonProps extends ButtonProps {
  /** Description for screen readers */
  ariaDescription?: string;
  /** Announce action on click */
  announceOnClick?: string;
  /** Loading state */
  loading?: boolean;
  /** Keyboard shortcut hint */
  shortcutHint?: string;
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  function AccessibleButton(
    {
      children,
      ariaDescription,
      announceOnClick,
      loading,
      shortcutHint,
      disabled,
      onClick,
      sx,
      ...props
    },
    ref
  ) {
    const { announce, settings } = useAccessibility();

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      if (announceOnClick) {
        announce(announceOnClick);
      }
      onClick?.(e);
    };

    return (
      <Button
        ref={ref}
        disabled={disabled || loading}
        onClick={handleClick}
        aria-describedby={ariaDescription ? `${props.id}-description` : undefined}
        aria-busy={loading}
        sx={{
          minWidth: settings.minimumTargetSize,
          minHeight: settings.minimumTargetSize , '&:focus-visible': FOCUS_STYLES,
          ...sx}}
        {...props}
      >
        {children}
        {loading && <VisuallyHidden>Loading...</VisuallyHidden>}
        {ariaDescription && (
          <VisuallyHidden id={`${props.id}-description`}>{ariaDescription}</VisuallyHidden>
        )}
        {shortcutHint && settings.showKeyboardHints && (
          <Typography
            component="span"
            variant="caption"
            sx={{
              ml: 1,
              opacity: 0.7,
              bgcolor: 'action.hover',
              px: 0.5,
              borderRadius: 0.5,
              fontSize: '0.65rem'}}
          >
            {shortcutHint}
          </Typography>
        )}
      </Button>
    );
  }
);

// ============================================================================
// AccessibleIconButton
// ============================================================================

interface AccessibleIconButtonProps extends IconButtonProps {
  /** Required label for screen readers */
  'aria-label': string;
  /** Announce action on click */
  announceOnClick?: string;
}

export const AccessibleIconButton = forwardRef<HTMLButtonElement, AccessibleIconButtonProps>(
  function AccessibleIconButton(
    { children, announceOnClick, onClick, sx, ...props },
    ref
  ) {
    const { announce, settings } = useAccessibility();

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      if (announceOnClick) {
        announce(announceOnClick);
      }
      onClick?.(e);
    };

    return (
      <IconButton
        ref={ref}
        onClick={handleClick}
        sx={{
          minWidth: settings.minimumTargetSize,
          minHeight: settings.minimumTargetSize, '&:focus-visible': FOCUS_STYLES,
          ...sx}}
        {...props}
      >
        {children}
      </IconButton>
    );
  }
);

// ============================================================================
// AccessibleSlider
// ============================================================================

interface AccessibleSliderProps extends Omit<SliderProps, 'onChange, '> {
  /** Accessible label */
  label: string;
  /** Value format for announcements */
  valueFormat?: (value: number) => string;
  /** Change handler */
  onChange: (value: number) => void;
  /** Announce value changes */
  announceOnChange?: boolean;
  /** Step announcement */
  stepAnnouncement?: string;
}

export function AccessibleSlider({
  label,
  value,
  valueFormat = (v) => String(v),
  onChange,
  announceOnChange = true,
  stepAnnouncement,
  min = 0,
  max = 100,
  step = 1,
  ...props
}: AccessibleSliderProps) {
  const { announce, settings } = useAccessibility();
  const sliderRef = useRef<HTMLSpanElement>(null);
  const [localValue, setLocalValue] = useState<number>(value as number);

  // Sync with external value
  useEffect(() => {
    setLocalValue(value as number);
  }, [value]);

  const handleChange = (_: Event, newValue: number | number[]) => {
    const val = Array.isArray(newValue) ? newValue[0] : newValue;
    setLocalValue(val);
    onChange(val);
  };

  const handleChangeCommitted = (_: React.SyntheticEvent | Event, newValue: number | number[]) => {
    const val = Array.isArray(newValue) ? newValue[0] : newValue;
    if (announceOnChange) {
      announce(`${label}: ${valueFormat(val)}`);
    }
  };

  // Keyboard increment/decrement with larger steps
  const handleKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    let newValue = localValue;
    const largeStep = (max - min) / 10;

    switch (e.key) {
      case 'PageUp':
        e.preventDefault();
        newValue = Math.min(max, localValue + largeStep);
        break;
      case 'PageDown':
        e.preventDefault();
        newValue = Math.max(min, localValue - largeStep);
        break;
      case 'Home':
        e.preventDefault();
        newValue = min;
        break;
      case 'End':
        e.preventDefault();
        newValue = max;
        break;
    }

    if (newValue !== localValue) {
      setLocalValue(newValue);
      onChange(newValue);
      if (announceOnChange) {
        announce(`${label}: ${valueFormat(newValue)}`);
      }
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography
        id={`${props.id || 'slider'}-label`}
        gutterBottom
        sx={{ display: 'flex', justifyContent: 'space-between' }}
      >
        <span>{label}</span>
        <span aria-hidden="true">{valueFormat(localValue)}</span>
      </Typography>
      <Slider
        ref={sliderRef}
        value={localValue}
        onChange={handleChange}
        onChangeCommitted={handleChangeCommitted}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
        step={step}
        aria-labelledby={`${props.id || 'slider'}-label`}
        aria-valuetext={valueFormat(localValue)}
        getAriaValueText={valueFormat}
        sx={{
          '& .MuiSlider-thumb': {
            width: Math.max(24, settings.minimumTargetSize / 2),
            height: Math.max(24, settings.minimumTargetSize / 2)'&:focus-visible': {
              boxShadow: `0 0 0 4px rgba(33, 150, 243, 0.4)`,
            },
          }, '& .MuiSlider-track': {
            height: 8,
          }, '& .MuiSlider-rail': {
            height: 8,
          }}}
        {...props}
      />
      {stepAnnouncement && (
        <VisuallyHidden>{stepAnnouncement}</VisuallyHidden>
      )}
    </Box>
  );
}

// ============================================================================
// AccessibleTabs
// ============================================================================

interface AccessibleTabsProps {
  value: number;
  onChange: (index: number) => void;
  tabs: Array<{
    label: string;
    id: string;
    icon?: ReactNode;
    disabled?: boolean;
  }>;
  children: ReactNode;
  orientation?: 'horizontal' | 'vertical';
  ariaLabel: string;
}

export function AccessibleTabs({
  value,
  onChange,
  tabs,
  children,
  orientation = 'horizontal',
  ariaLabel,
}: AccessibleTabsProps) {
  const { announce } = useAccessibility();
  const tablistRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const isHorizontal = orientation === 'horizontal';
    const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';

    let newIndex = value;

    switch (e.key) {
      case nextKey:
        e.preventDefault();
        // Find next non-disabled tab
        for (let i = 1; i <= tabs.length; i++) {
          const idx = (value + i) % tabs.length;
          if (!tabs[idx].disabled) {
            newIndex = idx;
            break;
          }
        }
        break;
      case prevKey:
        e.preventDefault();
        // Find previous non-disabled tab
        for (let i = 1; i <= tabs.length; i++) {
          const idx = (value - i + tabs.length) % tabs.length;
          if (!tabs[idx].disabled) {
            newIndex = idx;
            break;
          }
        }
        break;
      case 'Home':
        e.preventDefault();
        // Find first non-disabled tab
        newIndex = tabs.findIndex((t) => !t.disabled);
        break;
      case 'End':
        e.preventDefault();
        // Find last non-disabled tab
        for (let i = tabs.length - 1; i >= 0; i--) {
          if (!tabs[i].disabled) {
            newIndex = i;
            break;
          }
        }
        break;
    }

    if (newIndex !== value) {
      onChange(newIndex);
      announce(`${tabs[newIndex].label} tab selected, `);
      
      // Focus the new tab
      const tabButton = tablistRef.current?.querySelector(`[data-tab-index="${newIndex}, "]`) as HTMLElement;
      tabButton?.focus();
    }
  };

  return (
    <Box>
      <Box
        ref={tablistRef}
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation={orientation}
        onKeyDown={handleKeyDown}
        sx={{
          display: 'flex',
          flexDirection: orientation === 'vertical' ? 'column' : 'row',
          borderBottom: orientation === 'horizontal' ? 1 : 0,
          borderRight: orientation === 'vertical' ? 1 : 0,
          borderColor: 'divider'}}
      >
        {tabs.map((tab, index) => (
          <Box
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={value === index}
            aria-controls={`tabpanel-${tab.id}`}
            aria-disabled={tab.disabled}
            tabIndex={value === index ? 0 : -1}
            data-tab-index={index}
            onClick={() => {
              if (!tab.disabled) {
                onChange(index);
                announce(`${tab.label} tab selected`);
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1.5,
              cursor: tab.disabled ? 'not-allowed' : 'pointer',
              opacity: tab.disabled ? 0.5 : 1,
              bgcolor: value === index ? 'action.selected' : 'transparent',
              borderBottom: value === index && orientation === 'horizontal' ? 2 : 0,
              borderRight: value === index && orientation === 'vertical' ? 2 : 0,
              borderColor: 'primary.main',
              minWidth: MIN_TARGET_SIZE,
              minHeight: MIN_TARGET_SIZE, '&:hover: not([aria-disabled="true"])': { bgcolor: 'action.hover',
              }, '&:focus-visible': FOCUS_STYLES}}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </Box>
        ))}
      </Box>
      
      {React.Children.map(children, (child, index) => (
        <Box
          key={tabs[index]?.id || index}
          role="tabpanel"
          id={`tabpanel-${tabs[index]?.id}`}
          aria-labelledby={`tab-${tabs[index]?.id}`}
          hidden={value !== index}
          tabIndex={0}
        >
          {value === index && child}
        </Box>
      ))}
    </Box>
  );
}

// ============================================================================
// AccessibleDialog
// ============================================================================

interface AccessibleDialogProps extends Omit<DialogProps, 'onClose'> {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  /** Initial focus selector */
  initialFocus?: string;
  /** Description for screen readers */
  description?: string;
}

export function AccessibleDialog({
  title,
  onClose,
  children,
  actions,
  initialFocus,
  description,
  open,
  ...props
}: AccessibleDialogProps) {
  const { announce } = useAccessibility();
  const dialogId = `dialog-${title.toLowerCase().replace(/\s+/g, '-,')}`;
  
  // Focus trap
  useFocusTrap(dialogId, open, initialFocus || `#${dialogId}-close`);

  // Announce when opened
  useEffect(() => {
    if (open) {
      announce(`${title} dialog opened`'assertive');
    }
  }, [open, title, announce]);

  // Close on Escape
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      announce(`${title} dialog closed`);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
        announce(`${title} dialog closed`);
      }}
      onKeyDown={handleKeyDown}
      aria-labelledby={`${dialogId}-title`}
      aria-describedby={description ? `${dialogId}-description` : undefined}
      id={dialogId}
      {...props}
    >
      <DialogTitle
        id={`${dialogId}-title`}
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        {title}
        <AccessibleIconButton
          id={`${dialogId}-close`}
          aria-label="Close dialog"
          onClick={() => {
            onClose();
            announce(`${title} dialog closed`);
          }}
          size="small"
        >
          <CloseIcon />
        </AccessibleIconButton>
      </DialogTitle>
      
      <DialogContent>
        {description && (
          <Typography id={`${dialogId}-description`} sx={{ mb: 2 }}>
            {description}
          </Typography>
        )}
        {children}
      </DialogContent>
      
      {actions && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
}

// ============================================================================
// AccessibleDraggable - WCAG 2.5.7 Dragging Movements Alternative
// ============================================================================

interface AccessibleDraggableProps {
  children: ReactNode;
  /** Current position index */
  index: number;
  /** Total items count */
  totalItems: number;
  /** Move item callback */
  onMove: (fromIndex: number, toIndex: number) => void;
  /** Item label for announcements */
  itemLabel: string;
  /** Enable drag-drop */
  enableDrag?: boolean;
  /** Additional content when in keyboard move mode */
  moveInstructions?: string;
}

export function AccessibleDraggable({
  children,
  index,
  totalItems,
  onMove,
  itemLabel,
  enableDrag = true,
  moveInstructions = 'Use arrow keys to move, Enter to confirm, Escape to cancel',
}: AccessibleDraggableProps) {
  const { announce, settings } = useAccessibility();
  const [isMoving, setIsMoving] = useState(false);
  const [tempIndex, setTempIndex] = useState(index);
  const containerRef = useRef<HTMLDivElement>(null);

  // Start keyboard move mode
  const startMove = () => {
    setIsMoving(true);
    setTempIndex(index);
    announce(`Moving ${itemLabel}. ${moveInstructions}`'assertive');
  };

  // Confirm move
  const confirmMove = () => {
    if (tempIndex !== index) {
      onMove(index, tempIndex);
      announce(`${itemLabel} moved to position ${tempIndex + 1}`);
    } else {
      announce('Move cancelled');
    }
    setIsMoving(false);
  };

  // Cancel move
  const cancelMove = () => {
    setTempIndex(index);
    setIsMoving(false);
    announce('Move cancelled');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isMoving) {
      // Start move with Space or Enter
      if (e.key === ', ' || e.key === 'Enter') {
        e.preventDefault();
        startMove();
      }
      return;
    }

    // In moving mode
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        if (tempIndex > 0) {
          setTempIndex(tempIndex - 1);
          announce(`Position ${tempIndex}`);
        } else {
          announce('At start of list');
        }
        break;
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        if (tempIndex < totalItems - 1) {
          setTempIndex(tempIndex + 1);
          announce(`Position ${tempIndex + 2}`);
        } else {
          announce('At end of list');
        }
        break;
      case 'Home':
        e.preventDefault();
        setTempIndex(0);
        announce('Position 1');
        break;
      case 'End':
        e.preventDefault();
        setTempIndex(totalItems - 1);
        announce(`Position ${totalItems}`);
        break;
      case 'Enter':
        e.preventDefault();
        confirmMove();
        break;
      case 'Escape':
        e.preventDefault();
        cancelMove();
        break;
    }
  };

  return (
    <Box
      ref={containerRef}
      role="listitem"
      aria-grabbed={isMoving}
      aria-dropeffect={isMoving ? 'move' : 'none'}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      draggable={enableDrag && !isMoving}
      sx={{
        position: 'relative',
        cursor: enableDrag ? 'grab' : 'default',
        outline: isMoving ? `3px solid ${settings.focusOutlineColor}` : 'none',
        outlineOffset: '2px',
        transition: settings.reducedMotion ? 'none' : 'all 0.2s',
        transform: isMoving ? `translateY(${(tempIndex - index) * 48}px)` : 'none','&: focus-visible': FOCUS_STYLES, '&:active': {
          cursor: 'grabbing',
        }}}
    >
      {/* Move handle for keyboard users */}
      <Box
        sx={{
          position: 'absolute',
          left: -40,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          opacity: 0, '&:focus-within, &:hover': {
            opacity: 1,
          }}}
      >
        <AccessibleIconButton
          aria-label={`Move ${itemLabel} up, `}
          onClick={() => {
            if (index > 0) {
              onMove(index, index - 1);
              announce(`${itemLabel} moved up to position ${index}`);
            }
          }}
          disabled={index === 0}
          size="small"
        >
          <ArrowUpward fontSize="small" />
        </AccessibleIconButton>
        <AccessibleIconButton
          aria-label={`Move ${itemLabel} down`}
          onClick={() => {
            if (index < totalItems - 1) {
              onMove(index, index + 1);
              announce(`${itemLabel} moved down to position ${index + 2}`);
            }
          }}
          disabled={index === totalItems - 1}
          size="small"
        >
          <ArrowDownward fontSize="small" />
        </AccessibleIconButton>
      </Box>

      {/* Visual drag indicator */}
      {enableDrag && (
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'text.secondary',
            cursor: 'grab'}}
        >
          <DragIndicator />
        </Box>
      )}

      {/* Content */}
      <Box sx={{ pl: enableDrag ? 4 : 0 }}>{children}</Box>

      {/* Moving mode indicator */}
      {isMoving && (
        <Box
          sx={{
            position: 'absolute',
            bottom: -24,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'primary.main',
            color: 'white',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.75rem',
            whiteSpace: 'nowrap'}}
        >
          Position {tempIndex + 1} of {totalItems}
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// AccessibleList - Keyboard navigable list
// ============================================================================

interface AccessibleListProps<T> {
  items: T[];
  renderItem: (item: T, index: number, isSelected: boolean) => ReactNode;
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  onDelete?: (index: number) => void;
  ariaLabel: string;
  emptyMessage?: string;
  getItemLabel: (item: T) => string;
}

export function AccessibleList<T>({
  items,
  renderItem,
  selectedIndex = -1,
  onSelect,
  onDelete,
  ariaLabel,
  emptyMessage = 'No items',
  getItemLabel,
}: AccessibleListProps<T>) {
  const { announce, settings } = useAccessibility();
  const listRef = useRef<HTMLUListElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(selectedIndex);

  const handleKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    let newIndex = focusedIndex;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        newIndex = Math.min(items.length - 1, focusedIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        newIndex = Math.max(0, focusedIndex - 1);
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = items.length - 1;
        break;
      case 'Enter':
      case '':
        e.preventDefault();
        if (onSelect && focusedIndex >= 0) {
          onSelect(focusedIndex);
          announce(`${getItemLabel(items[focusedIndex])} selected`);
        }
        return;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        if (onDelete && focusedIndex >= 0) {
          const label = getItemLabel(items[focusedIndex]);
          onDelete(focusedIndex);
          announce(`${label} deleted`);
          // Adjust focus
          if (focusedIndex >= items.length - 1) {
            setFocusedIndex(Math.max(0, items.length - 2));
          }
        }
        return;
    }

    if (newIndex !== focusedIndex && newIndex >= 0 && newIndex < items.length) {
      setFocusedIndex(newIndex);
      announce(getItemLabel(items[newIndex]));
      
      // Focus the item
      const item = listRef.current?.querySelector(`[data-index="${newIndex}"]`) as HTMLElement;
      item?.focus();
    }
  };

  if (items.length === 0) {
    return (
      <Box
        role="list"
        aria-label={ariaLabel}
        sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}
      >
        {emptyMessage}
      </Box>
    );
  }

  return (
    <List
      ref={listRef}
      role="listbox"
      aria-label={ariaLabel}
      aria-activedescendant={focusedIndex >= 0 ? `item-${focusedIndex}` : undefined}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      sx={{
        '&:focus-visible': FOCUS_STYLES}}
    >
      {items.map((item, index) => (
        <ListItem
          key={index}
          id={`item-${index}`}
          data-index={index}
          role="option"
          aria-selected={selectedIndex === index}
          tabIndex={focusedIndex === index ? 0 : -1}
          onClick={() => {
            setFocusedIndex(index);
            onSelect?.(index);
            announce(`${getItemLabel(item)} selected`);
          }}
          sx={{
            minHeight: settings.minimumTargetSize,
            bgcolor: selectedIndex === index ? 'action.selected' : 'transparent', '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': FOCUS_STYLES}}
        >
          {renderItem(item, index, selectedIndex === index)}
        </ListItem>
      ))}
    </List>
  );
}

// ============================================================================
// AccessibleTooltip
// ============================================================================

interface AccessibleTooltipProps {
  children: React.ReactElement;
  title: string;
  /** Also show on focus (not just hover) */
  showOnFocus?: boolean;
  /** Description ID for aria-describedby */
  descriptionId?: string;
}

export function AccessibleTooltip({
  children,
  title,
  showOnFocus = true,
  descriptionId,
}: AccessibleTooltipProps) {
  const { isReducedMotion } = useAccessibility();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip
        title={title}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        TransitionComponent={Fade}
        TransitionProps={{
          timeout: isReducedMotion ? 0 : 200}}
        arrow
        enterDelay={200}
        leaveDelay={0}
      >
        {React.cloneElement(children, {
          onFocus: showOnFocus ? () => setOpen(true) : undefined,
          onBlur: showOnFocus ? () => setOpen(false) : undefined'aria-describedby': descriptionId,
        })}
      </Tooltip>
      {descriptionId && (
        <VisuallyHidden id={descriptionId}>{title}</VisuallyHidden>
      )}
    </>
  );
}

// ============================================================================
// AccessibleProgress
// ============================================================================

interface AccessibleProgressProps {
  value: number;
  max?: number;
  label: string;
  showValue?: boolean;
}

export function AccessibleProgress({
  value,
  max = 100,
  label,
  showValue = true,
}: AccessibleProgressProps) {
  const percentage = Math.round((value / max) * 100);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        {showValue && (
          <Typography variant="body2" aria-hidden="true">
            {percentage}%
          </Typography>
        )}
      </Box>
      <Box
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${percentage}%`}
        sx={{
          width: '100%',
          height: 8,
          bgcolor: 'action.hover',
          borderRadius: 4,
          overflow: 'hidden'}}
      >
        <Box
          sx={{
            width: `${percentage}%`,
            height: '100%',
            bgcolor: 'primary.main',
            transition: 'width 0.3s ease'}}
        />
      </Box>
    </Box>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default {
  AccessibleButton,
  AccessibleIconButton,
  AccessibleSlider,
  AccessibleTabs,
  AccessibleDialog,
  AccessibleDraggable,
  AccessibleList,
  AccessibleTooltip,
  AccessibleProgress,
};

