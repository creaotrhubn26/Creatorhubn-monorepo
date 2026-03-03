import * as React from 'react';
import {
  Box,
  Button,
  Dialog as MuiDialog,
  DialogContent as MuiDialogContent,
  Typography,
  type ButtonProps,
  type DialogProps as MuiDialogProps,
} from '@mui/material';

interface AlertDialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(null);

function useAlertDialogContext(componentName: string): AlertDialogContextValue {
  const context = React.useContext(AlertDialogContext);
  if (!context) {
    throw new Error(`${componentName} must be used within <AlertDialog>`);
  }
  return context;
}

export interface AlertDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function AlertDialog({ open, defaultOpen = false, onOpenChange, children }: AlertDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const resolvedOpen = open ?? internalOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (open === undefined) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [onOpenChange, open],
  );

  return <AlertDialogContext.Provider value={{ open: resolvedOpen, setOpen }}>{children}</AlertDialogContext.Provider>;
}

export interface AlertDialogContentProps extends Omit<MuiDialogProps, 'open' | 'onClose' | 'children'> {
  children: React.ReactNode;
  className?: string;
}

export function AlertDialogContent({
  children,
  className,
  maxWidth = 'sm',
  fullWidth = true,
  ...props
}: AlertDialogContentProps) {
  const { open, setOpen } = useAlertDialogContext('AlertDialogContent');

  return (
    <MuiDialog
      {...props}
      open={open}
      onClose={() => setOpen(false)}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      PaperProps={{ className }}
    >
      <MuiDialogContent>{children}</MuiDialogContent>
    </MuiDialog>
  );
}

export function AlertDialogHeader({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Box> & { children: React.ReactNode }) {
  return (
    <Box {...props} className={className} sx={{ pb: 1, ...(props.sx ?? {}) }}>
      {children}
    </Box>
  );
}

export function AlertDialogTitle({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Typography> & { children: React.ReactNode }) {
  return (
    <Typography {...props} className={className} variant="h6">
      {children}
    </Typography>
  );
}

export function AlertDialogDescription({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Typography> & { children: React.ReactNode }) {
  return (
    <Typography {...props} className={className} variant="body2" color="text.secondary">
      {children}
    </Typography>
  );
}

export function AlertDialogFooter({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Box> & { children: React.ReactNode }) {
  return (
    <Box
      {...props}
      className={className}
      sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 2, ...(props.sx ?? {}) }}
    >
      {children}
    </Box>
  );
}

export function AlertDialogAction({ children, onClick, ...props }: ButtonProps) {
  const { setOpen } = useAlertDialogContext('AlertDialogAction');
  return (
    <Button
      {...props}
      variant={props.variant ?? 'contained'}
      color={props.color ?? 'error'}
      onClick={(event) => {
        onClick?.(event);
        setOpen(false);
      }}
    >
      {children}
    </Button>
  );
}

export function AlertDialogCancel({ children, onClick, ...props }: ButtonProps) {
  const { setOpen } = useAlertDialogContext('AlertDialogCancel');
  return (
    <Button
      {...props}
      variant={props.variant ?? 'outlined'}
      onClick={(event) => {
        onClick?.(event);
        setOpen(false);
      }}
    >
      {children}
    </Button>
  );
}

export default AlertDialog;
