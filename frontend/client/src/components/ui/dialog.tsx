import * as React from 'react';
import {
  Box,
  Button,
  Dialog as MuiDialog,
  DialogContent as MuiDialogContent,
  DialogTitle as MuiDialogTitle,
  Typography,
  type DialogProps as MuiDialogProps,
} from '@mui/material';

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext(componentName: string): DialogContextValue {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error(`${componentName} must be used within <Dialog>`);
  }
  return context;
}

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, defaultOpen = false, onOpenChange, children }: DialogProps) {
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

  return <DialogContext.Provider value={{ open: resolvedOpen, setOpen }}>{children}</DialogContext.Provider>;
}

function composeOnClick<T extends HTMLElement>(
  existing?: React.MouseEventHandler<T>,
  extra?: React.MouseEventHandler<T>,
): React.MouseEventHandler<T> {
  return (event) => {
    existing?.(event);
    extra?.(event);
  };
}

export interface DialogTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

export function DialogTrigger({ asChild = false, children }: DialogTriggerProps) {
  const { setOpen } = useDialogContext('DialogTrigger');
  const openDialog: React.MouseEventHandler<HTMLElement> = () => setOpen(true);

  if (asChild && React.isValidElement(children)) {
    const childProps = (children.props ?? {}) as {
      onClick?: React.MouseEventHandler<HTMLElement>;
    };

    return React.cloneElement(children, {
      onClick: composeOnClick(childProps.onClick, openDialog),
    });
  }

  return (
    <Button variant="outlined" onClick={openDialog}>
      {children}
    </Button>
  );
}

export interface DialogContentProps extends Omit<MuiDialogProps, 'open' | 'onClose' | 'children'> {
  children: React.ReactNode;
  className?: string;
}

export function DialogContent({ children, className, maxWidth = 'md', fullWidth = true, ...props }: DialogContentProps) {
  const { open, setOpen } = useDialogContext('DialogContent');
  return (
    <MuiDialog
      {...props}
      open={open}
      onClose={() => setOpen(false)}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      PaperProps={{ className }}
    >
      <MuiDialogContent dividers>{children}</MuiDialogContent>
    </MuiDialog>
  );
}

export function DialogHeader({
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

export function DialogTitle({
  children,
  className,
  ...props
}: React.ComponentProps<typeof MuiDialogTitle> & { children: React.ReactNode }) {
  return (
    <MuiDialogTitle {...props} className={className} sx={{ p: 0, ...(props.sx ?? {}) }}>
      {children}
    </MuiDialogTitle>
  );
}

export function DialogDescription({
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

export function DialogFooter({
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

export default Dialog;
